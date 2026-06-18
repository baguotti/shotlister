const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:5174');
  
  await page.waitForSelector('#shotBody tr');
  
  // wait 1 sec for rendering
  await new Promise(r => setTimeout(r, 1000));

  await page.pdf({
    path: 'debug_print.pdf',
    format: 'A4',
    landscape: true,
    printBackground: true
  });
  
  console.log('PDF saved as debug_print.pdf');
  await browser.close();
})();
