const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  console.log('Navigating to localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  try {
    // Click New Project
    console.log('Clicking btnNewProject...');
    await page.click('#btnNewProject');
    await new Promise(r => setTimeout(r, 500));
    
    // Click Add Shot
    console.log('Clicking btnAddRow...');
    await page.click('#btnAddRow');
    await new Promise(r => setTimeout(r, 500));
    
    console.log('Clicking btnGroupMode...');
    await page.click('#btnGroupMode');
    await new Promise(r => setTimeout(r, 500));

    console.log('Clicking btnSettingsToggle...');
    await page.click('#btnSettingsToggle');
    await new Promise(r => setTimeout(r, 500));
    
    console.log('Successfully clicked buttons. Capturing screenshot.');
    await page.screenshot({ path: 'test_clicks.png' });
  } catch (err) {
    console.error('Error during click test:', err.message);
  }
  
  await browser.close();
})();
