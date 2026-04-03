import Stripe from 'stripe';

// Vercel serverless function — receives raw body for webhook signature verification
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Stripe environment variables are missing' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
    expand: ['customer', 'payment_intent.payment_method'],
  });

  let customerId = session.customer?.id ?? session.customer;
  const paymentMethod = session.payment_intent?.payment_method;
  const paymentMethodId = paymentMethod?.id;
  const customerName = session.customer_details?.name ?? 'Unknown';
  const customerEmail = session.customer_details?.email ?? '';
  const existingPaymentMethodCustomer =
    paymentMethod?.customer?.id ?? paymentMethod?.customer ?? null;

  if (!paymentMethodId) {
    console.error('Missing payment method on session', session.id);
    return res.status(200).json({ received: true });
  }

  // Payment Links can complete without creating a reusable Stripe customer.
  // Create one from checkout details so we can save the card for the balance payment.
  if (!customerId) {
    if (existingPaymentMethodCustomer) {
      customerId = existingPaymentMethodCustomer;
    } else {
      const createdCustomer = await stripe.customers.create(
        {
          email: customerEmail || undefined,
          name: customerName !== 'Unknown' ? customerName : undefined,
          address: session.customer_details?.address ?? undefined,
          metadata: {
            source: 'checkout_session_completed',
            checkout_session_id: session.id,
            payment_link: session.payment_link ?? '',
          },
        },
        {
          idempotencyKey: `customer-for-session-${session.id}`,
        }
      );
      customerId = createdCustomer.id;
    }
  }

  // Avoid creating duplicate balance invoices if Stripe retries the webhook.
  const existingInvoices = await stripe.invoices.list({
    customer: customerId,
    status: 'draft',
    limit: 100,
  });

  const balanceInvoiceExists = existingInvoices.data.some(
    (invoice) =>
      invoice.metadata?.type === 'balance' &&
      invoice.metadata?.deposit_session === session.id
  );

  if (balanceInvoiceExists) {
    console.log(`Balance invoice already exists for session ${session.id}`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Attach the payment method to the customer and set as default for future charges.
  if (!existingPaymentMethodCustomer) {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  }

  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  // Create a draft invoice for the 60% balance ($4,800 NZD)
  await stripe.invoiceItems.create(
    {
      customer: customerId,
      amount: 480000, // $4,800.00 NZD in cents
      currency: 'nzd',
      description: 'NZ Group Trip 2026 - Balance Payment (60%)',
    },
    {
      idempotencyKey: `balance-invoice-item-${session.id}`,
    }
  );

  await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: 'charge_automatically',
      auto_advance: false, // keep as draft — cron will finalize on Aug 28
      metadata: {
        type: 'balance',
        scheduled_for: '2026-08-28',
        customer_name: customerName,
        customer_email: customerEmail,
        deposit_session: session.id,
      },
    },
    {
      idempotencyKey: `balance-invoice-${session.id}`,
    }
  );

  console.log(`Balance invoice created for ${customerName} (${customerEmail})`);
  return res.status(200).json({ received: true });
}
