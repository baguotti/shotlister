import fs from 'fs';

const content = fs.readFileSync('index.html', 'utf-8');

const styleMatch = content.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
if (styleMatch) {
  fs.mkdirSync('src', { recursive: true });
  fs.writeFileSync('src/styles.css', styleMatch[1]);
}

const mainScriptMatch = content.match(/<script>(?!\s*\{\s*const cs)([\s\S]*?)<\/script>/);
if (mainScriptMatch) {
  fs.mkdirSync('src', { recursive: true });
  fs.writeFileSync('src/app.js', mainScriptMatch[1].trim());
}

let newHtml = content.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/src/styles.css">');
newHtml = newHtml.replace(/<script>(?!\s*\{\s*const cs)[\s\S]*?<\/script>/, '<script type="module" src="/src/main.js"></script>');

fs.writeFileSync('index.html', newHtml);
console.log('Extraction complete');
