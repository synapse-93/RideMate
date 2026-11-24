# RideMate — Engineering & Agent Guidelines (`AGENTS.md`)

All contributors and autonomous agents working on this repository MUST strictly adhere to the following rules.

## 1. TypeScript & Code Quality
- `tsconfig.json` enforces `"strict": true`.
- **Zero `any`** and **zero `@ts-ignore` / `@ts-expect-error`** anywhere in `src/` or `prisma/`.
- Validate every API request body and query parameter using **`zod`**.
- Keep domain logic (distance math, fuel cost math, matching score) in pure, unit-tested modules under `src/lib/`.

## 2. Prisma ORM 7 Lock (CRITICAL)
- Use **`prisma@7`** (`devDependency`) and **`@prisma/client@7`** (`dependency`) together with `@prisma/adapter-pg` and `pg`.
- **NEVER** install Prisma 8 RC or upgrade major versions.
- Always invoke Prisma CLI commands with **`npx prisma@7`** (e.g., `npx prisma@7 validate`, `npx prisma@7 generate`).
- Use `prisma.config.ts` for datasource URL configuration as required by Prisma 7.
- Always import the singleton client from `src/lib/prisma.ts`.

## 3. Metric Units & Indian Rupee Currency
- Distance: **`km`** only (never miles).
- Speed: **`km/h`** only (never mph).
- Currency: **`INR`** (`₹`) formatted cleanly (e.g., `₹45`).

## 4. SSR-Safe Leaflet & Zero Paid APIs
- Leaflet touches `window` and `document` on import; **ALWAYS** load map components through `next/dynamic(..., { ssr: false })`.
- Use OpenStreetMap raster tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), Nominatim geocoding (debounced >= 400ms + client-side cache + Bengaluru campus quick-picks), and public OSRM (`router.project-osrm.org`).
- Always provide a **Haversine fallback** when OSRM or Nominatim rate-limits or fails.
- **Zero Paid Services:** Never introduce Google Maps, Mapbox, Twilio, Pusher, Clerk, or Stripe.

## 5. Security & Server-Side Invariants
- Authentication uses HttpOnly, SameSite=Lax JWT cookies (`jose`) and `bcryptjs` password hashing.
- **Women-Only Rides:** Must be enforced **server-side**:
  - Only users with `gender === 'FEMALE'` may create a ride with `womenOnly: true`.
  - Non-female (or unauthenticated) users must NEVER receive `womenOnly: true` rides from `/api/rides` or `/api/rides/match`, nor be able to request seats on them.
- **Atomic Seat Accounting:** Accepting or cancelling a `RideRequest` MUST run inside `prisma.$transaction(...)` checking `seatsAvailable` atomically.
- **Demo Simulation Disclosure:** Simulated Live GPS tracking, Simulated SOS, and Simulated Payment Settlement MUST always display a clear **"Demo Simulation"** badge in the UI.
