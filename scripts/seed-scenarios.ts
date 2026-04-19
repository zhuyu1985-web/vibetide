// ---------------------------------------------------------------------------
// DEPRECATED — do not run this script.
//
// All default scenario data has moved to `src/db/seed-data/scenarios.ts` and
// is now populated as part of the main seed. Running it was the direct cause
// of the Apr 2026 incident where DB resets left 7 of 8 employees with zero
// scenarios, because people remembered the main seed but forgot this one.
//
// To (re)seed default scenarios:
//   npm run db:seed
//
// This file is kept only to redirect anyone who still has the old command in
// their shell history.
// ---------------------------------------------------------------------------

console.error(
  [
    "scripts/seed-scenarios.ts has been removed.",
    "Scenario data is now part of the main seed.",
    "",
    "Run:  npm run db:seed",
  ].join("\n"),
);
process.exit(1);
