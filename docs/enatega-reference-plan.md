# WayCatalog Enatega Reference Plan

This document defines how WayCatalog uses the Enatega multi-vendor project as a product and architecture reference.

## Non-Negotiable Boundary

The public restaurant catalog experience stays intact unless a task explicitly asks to change it.

Protected areas:

- Customer-facing restaurant menu layout and browsing flow.
- Product/category display behavior in the public restaurant catalog.
- Cart and add-to-cart behavior, except when fixing order creation contracts.
- Existing restaurant catalog theme and dish presentation.

Allowed changes around the catalog:

- Restaurant admin screens that manage catalog data.
- Super-admin tools that provision restaurants, settlements, pricing, and banners.
- Driver, dispatch, finance, and order status workflows.
- Supabase schema, RPC, and RLS changes required for stable admin and driver operations.

## Reference Source

Local reference checkout:

`/Users/abdulkadyrov2002/Documents/enatega-food-delivery-multivendor`

Use Enatega for structure and product patterns, not direct copy-paste.

Important reference modules:

- Admin/store dashboard, orders, profile, location, timing, payment, coupons, and product-management screens.
- Rider order, map, active delivery, profile, earnings, and status flows.
- Customer web address, restaurant discovery, banners, profile, orders, and cart flows.
- Super-admin concepts for zones, riders, commissions, banners, wallets, withdrawals, and dispatch.

## Target Architecture

WayCatalog should evolve into a single PWA with clear role surfaces:

- Customer platform: city/settlement selection, restaurant discovery, profile, addresses, orders.
- Restaurant admin: dashboard, live orders, scanner, editable catalog admin, profile, payments, delivery settings.
- Driver app: fast login, online status, offers, active order, QR flow, map, earnings, profile.
- Super-admin: restaurants, drivers, settlements/zones, subscriptions, finance, banners, contests, audit log.

## Stage 1: Stable Identity And Sessions

Goal: refresh must not log users out.

Work:

- Unify session restore for restaurant admin, driver, super-admin, and client areas.
- Keep explicit logout as the only intentional exit.
- Remove slow auth checks from critical button paths.
- Make login buttons fail fast with useful messages.

Validation:

- Refresh restaurant admin, driver, super-admin, and client pages without losing session.
- Toggle driver online status without blocking UI for many seconds.

## Stage 2: Customer Geolocation And Settlements

Goal: customer location works like modern delivery apps.

Work:

- Ask for browser geolocation when the customer chooses delivery/location.
- Use best GPS reading and reverse geocode to settlement, street, and house when available.
- Persist delivery coordinates and human-readable address into order/session.
- Connect city/settlement selection to restaurant discovery.

Validation:

- Customer can choose current location and see street/house when provider returns it.
- Low-accuracy GPS produces a visible retry/check warning.

## Stage 3: Order Lifecycle Core

Goal: every role sees the same order state.

Work:

- Define one canonical order status flow.
- Keep status transitions in Supabase RPCs or a single API layer.
- Prevent accepted orders from jumping to another driver/order unexpectedly.
- Preserve QR handoff state after restaurant scan.

Validation:

- Create test order, restaurant accepts, driver accepts, QR confirms pickup, driver arrives, order completes.
- Restaurant, driver, and client order screens agree after refresh.

## Stage 4: Driver Operations

Goal: driver app is fast and predictable.

Work:

- Fast online/offline update with local optimistic UI and server reconciliation.
- Stable offers list and active order.
- Always-available map, even without active order.
- Smooth map pan/zoom/rotation and route arrow that follows vehicle direction.
- Driver profile editing and logout.

Validation:

- Driver can log in, refresh, go online, accept, reject, complete, and log out.
- Earnings/balance update after completed delivery.

## Stage 5: Restaurant Admin Rebuild

Goal: restaurant admin becomes a real working console while keeping public catalog intact.

Work:

- Rework dashboard around Enatega-style blocks: today orders, revenue, active orders, urgent actions.
- Rename bottom navigation to `Каталог`, `Заказы`, `Сканер`, `Настройки` as needed.
- Open scanner inside the admin shell, not as a detached page.
- Make catalog admin show the customer catalog data with edit controls.
- Add profile location picker using the same internal map flow.

Validation:

- Restaurant can manage profile, delivery settings, orders, scanner, and catalog data without leaving admin context.

## Stage 6: Finance And Super-Admin

Goal: balances, debts, tariffs, limits, and blocks are real data, not display-only fields.

Work:

- Add ledger-style transactions for driver earnings, restaurant debts, platform fees, and payouts.
- Add global and per-restaurant/per-driver tariffs.
- Add warning limits and block controls.
- Add contest tickets and admin-managed banners/promos.
- Add audit log for critical actions.

Validation:

- Completed order creates finance records.
- Super-admin can inspect and manage debts, limits, blocks, tariffs, and tickets.

## Migration Rule

Every Supabase change must be a migration under `supabase/migrations`.

Do not run `db push`, `db pull`, or destructive SQL without explicit confirmation.

For live fixes, prefer additive migrations and compatibility fallbacks until production data proves the new contract.
