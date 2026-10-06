// Собирает один HTML-файл для превью без сервера: весь код внутри, игра работает в браузере, соседи по комнате боты.
const fs = require('fs');
const path = require('path');
const pub = path.join(__dirname, '..', 'public');
const read = (p) => fs.readFileSync(path.join(pub, p), 'utf8');
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace('<script src="/vendor/socket.io.min.js"></script>\n', '')
  .replace(/<script src="([^"]+)"><\/script>/g, (_, src) => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);
const head = html.slice(html.indexOf('<title>'), html.indexOf('</head>'))
  .replace(/<meta name="viewport"[^>]*>\n?/, '')
  .replace('<link rel="stylesheet" href="css/app.css">', `<style>\n${read('css/app.css')}\n</style>`);
const out = path.join(__dirname, '..', 'dist');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'detective-preview.html'), `${head}\n${body}`);
console.log('dist/detective-preview.html', Math.round(fs.statSync(path.join(out, 'detective-preview.html')).size / 1024) + ' КБ');
