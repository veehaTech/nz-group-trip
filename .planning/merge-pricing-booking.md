# Plan: Merge Pricing + Booking into One Section

## Context
The site currently has two adjacent sections that repeat information:
1. **PRICING** (`id="pricing"`) — shows per-person price, initial deposit (40%), inclusions list, and a "Pay Deposit Now" CTA that just scrolls to the next section
2. **BOOKING** (`id="booking"`) — shows payment schedule (40% / 60%), trust signals, and another "Pay Deposit Now" CTA

The 40% deposit figure and the CTA appear in both, which feels redundant. Merging removes duplication and creates one clear transactional moment.

## Approach: Merge into a single `id="booking"` section

Delete the separate PRICING section and redesign the BOOKING section to contain everything:
- Per-person price placeholder
- What's included / Not included
- Payment schedule (40% / 60%)
- Single "Pay Deposit Now" CTA + "DM on Instagram" secondary CTA
- Trust signals (Stripe, email, spots)

Keep the gradient background (`gradient-booking`) from the current BOOKING section — it provides visual separation from the rest of the page.

## Layout Design

```
[Limited to 10 Travellers badge]

Invest in your Memories

Secure your spot...

┌─────────────────────────────────────────────────────────┐
│ Left col (price card)     │  Right col (inclusions)     │
│                           │                             │
│  PER PERSON               │  ✓ What's Included          │
│  NZD [PRICE]              │    - All accommodation...   │
│  Contact us for price     │    - 2 Group Dinners...     │
│                           │    - 11 activities...       │
│  ──────────────────       │    - Private Sprinter...    │
│                           │    - Ground transport...    │
│  PAYMENT SCHEDULE         │    - Expert coordination    │
│  [40% at booking]         │    - GST & local taxes      │
│  [60% — 28 Aug 2026]      │                             │
│                           │  ✗ Not Included             │
│  [Pay Deposit Now]        │    - Intl flights...        │
│  [DM on Instagram]        │    - Domestic flights...    │
│                           │    - Visa fees...           │
│  🔒 Stripe  ✉ email  👥10 │    - Travel insurance...   │
└─────────────────────────────────────────────────────────┘
```

On mobile: stacks vertically (price card → inclusions → CTAs)

## Files to Modify
- `sagar-ami-2026/index.html`
  - Remove entire PRICING section (~lines 1276–1374)
  - Redesign BOOKING section (~lines 1379–1445) to incorporate the price card and inclusions
  - Update nav link `href="#pricing"` → `href="#booking"` (if any)
  - Update floating CTA (already points to `#booking`)

## Key Details
- Keep `id="booking"` as the anchor (nav + floating CTA both reference it)
- Remove `id="pricing"` entirely (check if nav references it — it does via "The Trip" nav link which goes to `#about-trip`, not pricing)
- Keep price card structure: "NZD [PRICE]" and deposit note removed (no longer needed as separate item — payment schedule handles the 40% info)
- The price card in merged section shows only: PER PERSON / NZD [PRICE] / "Contact us for final price" — no separate deposit line since payment schedule already covers it
- Keep all existing CSS classes and design tokens

## Verification
- Open the page in browser and confirm:
  - Single unified section with price, inclusions, payment schedule, and CTA
  - No duplicate 40% or duplicate CTA buttons
  - Nav links still work (pricing nav item should be removed or updated)
  - Floating "Book Your Spot" CTA still scrolls to section correctly
  - Mobile layout stacks cleanly
