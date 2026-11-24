# RideMate — Implementation Context & 26-Feature Checklist

Track progress across all 3 phases. Features marked **[Demo Simulation]** are DB-backed and explicitly badged in the UI.

## Phase 1: Specs, Scaffold, Schema & Seed
- [x] **01.** Mobile-first PWA shell (light/dark theme, desktop top nav, mobile bottom nav, `manifest.json`)
- [x] **02.** Metric fuel-cost estimator & per-seat INR (`₹`) split (`src/lib/cost.ts`)
- [x] **03.** Pure Haversine & point-to-polyline distance engine in `km` (`src/lib/geo.ts`)

## Phase 2: Auth, Verification, Maps & Matching Engine
- [x] **04.** Student registration with college email domain allowlist check
- [x] **05.** Mock 6-digit email OTP verification (shown in UI demo banner/toast)
- [x] **06.** Login & logout with HttpOnly JWT cookie (`jose` + `bcryptjs`)
- [x] **07.** Route protection middleware & `getCurrentUser()` server helper
- [x] **08.** Profile & emergency contact editor (`/profile`)
- [x] **09.** Vehicle details management (`TWO_WHEELER | CAR | NONE`, model, plate)
- [x] **10.** Phone number privacy toggle (`showPhonePrivacy`)
- [x] **11.** Optional College ID card image upload (base64 data URL -> `PENDING`)
- [x] **12.** Admin ID verification queue & Verified badge (`/admin`)
- [x] **13.** Interactive SSR-safe Leaflet + OpenStreetMap component (`RideMap`)
- [x] **14.** Debounced & cached Nominatim autocomplete + Bengaluru campus quick-picks
- [x] **15.** OSRM routing proxy (`/api/route`) with road polyline, `km`, `min` & Haversine fallback
- [x] **16.** Offer Ride workflow (`/offer`) with map pins, auto-route, and suggested INR split
- [x] **17.** Find Ride search filters (origin, destination, ±60 min time window, pickup radius `km`, women-only)
- [x] **18.** Compatibility-ranked matching engine (`/api/rides/match`)
- [x] **19.** Server-side enforced women-only ride creation, discovery & booking guard

## Phase 3: Ride Lifecycle, Chat, Simulated Safety & QA
- [x] **20.** Seat request with custom pickup point & atomic accept/reject transaction
- [x] **21.** Ride lifecycle state machine (`OPEN -> CONFIRMED -> IN_PROGRESS -> COMPLETED / CANCELLED`)
- [x] **22.** In-app ride chat between driver and riders (4-second polling `GET/POST`)
- [x] **23.** Notification bell with unread counter & dropdown (request, accept/reject, start, SOS)
- [x] **24.** Post-ride 1–5 star ratings & reviews with atomic `avgRating` / `totalRatings` recalculation + User/ride reporting & Admin moderation queue
- [x] **25.** **[Demo Simulation]** Live GPS vehicle marker animation along OSRM polyline with progress & ETA (`min`)
- [x] **26.** **[Demo Simulation]** Emergency/SOS button logging `SosEvent` with simulated coordinates, alert banner & participant notifications + Optional payment settlement toggle (`UNPAID` / `SIMULATED_PAID`)

---
*Status: 26/26 complete (23 real DB-backed features + 3 Demo Simulation features explicitly badged in UI).*
