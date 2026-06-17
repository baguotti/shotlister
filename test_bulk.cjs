const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  await page.setViewport({ width: 1280, height: 800 });
  console.log("Navigating to localhost:5173...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // Wait for load
  await new Promise(r => setTimeout(r, 500));
  
  // Click New Project
  console.log("Clicking btnNewProject...");
  await page.click('#btnNewProject');
  await new Promise(r => setTimeout(r, 500));
  
  // We should have 3 rows from seedDefaults()
  const rows = await page.$$('#shotBody tr.selected, #shotBody tr:not(.selected)');
  console.log("Rows found: " + rows.length);

  // Click row checkboxes 0 and 1
  console.log("Selecting rows 0 and 1...");
  const checkboxes = await page.$$('.row-checkbox');
  await checkboxes[0].click();
  await checkboxes[1].click();
  await new Promise(r => setTimeout(r, 200));

  // Duplicate
  console.log("Clicking btnBulkDuplicate...");
  await page.click('#btnBulkDuplicate');
  await new Promise(r => setTimeout(r, 500));

  // Now we should have 5 rows
  const rowsAfterDup = await page.$$('#shotBody tr');
  console.log("Rows after duplicate: " + rowsAfterDup.length);

  console.log("Clicking btnBulkDelete...");
  
  // We can't handle window.confirm directly with page.click if it blocks, so we intercept dialogs:
  page.on('dialog', async dialog => {
    console.log("Dialog message: " + dialog.message());
    await dialog.accept();
  });

  await page.click('#btnBulkDelete');
  await new Promise(r => setTimeout(r, 500));

  const finalRows = await page.$$('#shotBody tr');
  console.log("Final rows: " + finalRows.length);

  await page.screenshot({ path: 'test_bulk.png' });
  console.log("Successfully tested bulk actions. Capturing screenshot.");

  await browser.close();
})();
