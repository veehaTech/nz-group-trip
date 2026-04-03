import Stripe from 'stripe';

// Vercel Cron job — runs 9:00pm UTC Aug 27 = 9:00am NZST Aug 28
// Finalizes all draft balance invoices, triggering automatic charge
export default async function handler(req, res) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Verify request is from Vercel Cron
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = { finalized: [], failed: [] };

  // List all draft invoices tagged as balance payments
  const invoices = await stripe.invoices.list({
    status: 'draft',
    limit: 100,
  });

  const balanceInvoices = invoices.data.filter(
    (inv) => inv.metadata?.type === 'balance'
  );

  for (const invoice of balanceInvoices) {
    try {
      await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: true });
      results.finalized.push({
        id: invoice.id,
      });
      console.log(`Finalized balance invoice ${invoice.id}`);
    } catch (err) {
      results.failed.push({ id: invoice.id, error: err.message });
      console.error(`Failed to finalize invoice ${invoice.id}:`, err.message);
    }
  }

  return res.status(200).json(results);
}
