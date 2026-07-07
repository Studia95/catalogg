---
name: catalogg-working-order
description: Preserve and debug the known-good WayCatalog restaurant order flow. Use when working on public checkout, WhatsApp hybrid order links, push/order status links, Supabase restaurant order RPCs, idempotency, PWA order sessions, or the toast "Заказ откроется в WhatsApp. В системе ресторана он пока не сохранён."
---

# Catalogg Working Order

## Golden Path

Keep the restaurant order flow in this order:

1. Create the order in Supabase first.
2. Receive the real `orderId`.
3. Build the public status URL with `buildOrderStatusShareUrl`.
4. Open WhatsApp with a link to the already-created order.

The WhatsApp link must point to an existing order status route, usually `/#/:slug/order/:orderId`. Opening that route must call `get_public_restaurant_order_status` and display current state. It must not create another order.

The fallback toast "Заказ откроется в WhatsApp. В системе ресторана он пока не сохранён." means the Supabase order creation failed before an `orderId` was available. Treat it as a production bug unless the user explicitly wants WhatsApp-only fallback behavior.

## Files To Inspect First

Read these files before changing order behavior:

- `src/shared/api/restaurantOrderPayload.ts`
- `src/shared/api/clientPlatformApi.ts`
- `src/shared/api/restaurantOrdersApi.ts`
- `src/app/App.tsx`
- `supabase/order_idempotency.sql`
- `scripts/tests/sqlOrderIdempotency.test.mjs`
- `scripts/tests/clientPlatformOrderContract.test.mjs`
- `src/shared/api/restaurantOrdersApi.test.ts`

Also inspect `dist/index.html`, `dist/sw.js`, and the active `dist/assets/index-*.js` when debugging GitHub Pages output.

## Invariants

Preserve these behaviors:

- Public checkout uses a submit lock so accidental double clicks do not create duplicate orders.
- The client sends `idempotency_key` when possible.
- The backend enforces idempotency through `orders.idempotency_key` and the unique index in `supabase/order_idempotency.sql`.
- The frontend tolerates old or broken deployed SQL by retrying without `idempotency_key` for missing overloads and the `42702` ambiguous `idempotency_key` error.
- WhatsApp status links reuse the existing order and never submit a new cart.
- PWA resume/session changes must keep explicit logout as the only intentional exit path for restaurant, driver, super admin, and client areas.

Do not remove the compatibility fallback unless the live Supabase project has definitely been migrated and the user asks to drop legacy support.

## Supabase SQL Notes

The fixed SQL must qualify `idempotency_key` on the `orders` table. In PL/pgSQL, an unqualified reference like this is broken:

```sql
and idempotency_key = normalized_idempotency_key
```

Use an alias:

```sql
from public.orders o
where o.catalog_id = target_catalog_id
  and o.idempotency_key = normalized_idempotency_key
```

Production error signature for this bug:

```text
42702 column reference "idempotency_key" is ambiguous
```

If that appears, keep the frontend retry and apply the fixed SQL.

Apply the SQL only after Supabase auth is available:

```bash
npx -y supabase@latest db query --linked --file supabase/order_idempotency.sql
```

If the CLI reports `Access token not provided`, ask the user to run `npx -y supabase@latest login` or set `SUPABASE_ACCESS_TOKEN`. Never ask the user to paste the token into chat.

## Debug Signatures

Use these signatures to classify failures:

- `PGRST202` or "could not find the function": deployed SQL is missing the new RPC overload; frontend should retry legacy payload.
- `42702` plus `idempotency_key` plus "ambiguous": deployed SQL has the broken unqualified column; frontend should retry without `idempotency_key`, then fixed SQL should be applied.
- WhatsApp opens but restaurant does not receive order: creation RPC failed before `orderId`; inspect `createRestaurantOrderFromCart`, `createRestaurantOrderWithClient`, and browser console/network response.
- Status link creates a new order: route handling is wrong; `/:slug/order/:orderId` must use `getPublicRestaurantOrderStatus`, not checkout submit logic.

## Required Checks

Run these before claiming the order flow is fixed:

```bash
node --test scripts/tests/sqlOrderIdempotency.test.mjs scripts/tests/sqlSupabaseFunctionSearchPath.test.mjs scripts/tests/clientPlatformOrderContract.test.mjs
npm run lint
npm run typecheck
npm run build
```

When changing status mapping or RPC response parsing, also run:

```bash
node --test src/shared/api/restaurantOrdersApi.test.ts
```

Avoid creating real live orders during diagnostics unless the user approves. If a live check is necessary, use an obvious test customer/comment and explain that it will write to Supabase.

## Deployment Notes

This repo tracks built GitHub Pages assets. After `npm run build`, verify `git status` includes the new `dist/assets/index-*.js`, updated `dist/index.html`, and updated `dist/sw.js`. Remove old generated assets only when the build replaced them.

If GitHub Pages still serves the old bundle, inspect live `index.html` to find the active asset name and compare it to local `dist/index.html`.
