# LibTrack mobile

Expo Router app (SDK 58).

```bash
cp .env.example .env     # set EXPO_PUBLIC_API_URL (see below)
npm install
npx expo start
npm run typecheck
```

## Two modes, no mixing

All screens call one `api` object (`src/api/index.ts`) that implements the `LibraryApi` interface (`src/api/types.ts`):

- **API mode**: `EXPO_PUBLIC_API_URL` is set. `src/api/httpClient.ts` talks to the backend for catalogue, availability, loans, eligibility, the dashboard action centre, renewals, returns, fines and notifications. Errors such as "Cannot reach the LibTrack server" are shown on screen. **Nothing silently falls back to mock data.**
- **Offline mock mode**: `EXPO_PUBLIC_API_URL` is unset. `src/api/mockStore.ts` serves the bundled demo data and follows the same rules as the backend.

The dashboard's "Needs your attention" list, eligibility badges and suggested actions come from the backend's `GET /api/actions`. The app does not re-derive them on the device.

| Device | `EXPO_PUBLIC_API_URL` |
| :--- | :--- |
| Android emulator | `http://10.0.2.2:4000` |
| Physical phone (same Wi-Fi) | `http://<your-computer-LAN-IP>:4000` |
| Web / iOS simulator | `http://localhost:4000` |

Restart `npx expo start` after changing `.env`.

## Session and preferences

- Sign-in is saved with `expo-secure-store` (Keychain / Keystore; `localStorage` on web) and restored on launch. If the server rejects the token (expired, secret rotated), the app signs out and says so.
- The Light / Dark / System theme choice is saved too.
- Demo students use the password `demo1234`; the quick sign-in buttons fill it in.

## Clock

`EXPO_PUBLIC_DEMO_NOW` pins the app clock. Keep it equal to the backend's `DEMO_NOW`. Unset means real time in API mode, and in mock mode the date the bundled data was written for.

## Fines display

The Fines screen shows **Owed** (fine ledger) and **Accruing** (estimate for overdue books if returned today) as separate figures. The loan screen shows the estimate and any recorded ledger amount separately as well.
