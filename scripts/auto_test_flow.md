Auto Test Flow
================

This is a simple guide for running the automated UI checks we use during development.

Requirements
- Node.js (v16+)
- npm

Install (optional)
```
npx playwright install
```

Quick manual run using Playwright (if you have Playwright installed):
```
npx playwright test --project=chromium --config=./playwright.config.js
```

Alternatively you can run the quick Puppeteer-style check using the browser devtools: launch the app at http://127.0.0.1:8000 and perform these steps:
1. Switch to `Stopwatch` mode and `Start` the timer.
2. Wait ~6 seconds and click `Finish & Save`.
3. Open `Analytics` and verify the `Total Focus Time` shows `6s`.
4. Create or trigger an upcoming scheduled block and verify the Up-Next banner appears; click the ✕ to dismiss and confirm it disappears and a `dismissedUpNext_...` key is stored in `localStorage`.

Notes
- The repository contains inline browser-evaluation helpers used by our dev automation — you can replicate the earlier automated runs by running Playwright or by using the browser console commands shown in the dev session logs.
