const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8000/index.html');
  // Dismiss login modal if present (Continue Offline)
  const loginModal = await page.$('#loginModal');
  if (loginModal) {
    const isVisible = await loginModal.isVisible().catch(() => false);
    if (isVisible) {
      await page.click('#cancelLoginBtn');
      await page.waitForTimeout(250);
    }
  }

  // Start stopwatch, wait 3s, finish -> continue, wait 2s, finish -> check analytics
  await page.click('#modeStopwatch');
  await page.click('#toggleTimerBtn');
  await page.waitForTimeout(3000);
  await page.click('#finishTimerBtn');

  // Click continue
  await page.click('#continueTimerBtn');
  await page.waitForTimeout(2000);
  await page.click('#finishTimerBtn');

  // Open analytics
  await page.click('button.tab-btn[data-tab="stats"]');
  await page.waitForSelector('#statsTotalTime');
  const total = await page.$eval('#statsTotalTime', el => el.innerText);
  console.log('Total after two segments:', total);

  await browser.close();
})();
