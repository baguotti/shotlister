import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));
  page.on('requestfailed', req => console.error('REQUEST FAILED:', req.url(), req.failure().errorText));

  console.log("Navigating to localhost:5173...");
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

  // Click btnAddRow
  try {
    await page.waitForSelector('#btnAddRow');
    await page.click('#btnAddRow');
    console.log("Clicked btnAddRow successfully.");
  } catch (e) {
    console.error("Failed to click btnAddRow:", e.message);
  }

  await browser.close();
})();
