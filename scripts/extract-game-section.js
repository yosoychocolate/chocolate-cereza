const fs = require('fs');
const path = require('path');

const src = process.argv[2] || path.join(require('os').tmpdir(), 'cc-index.html');
const html = fs.readFileSync(src, 'utf8');
const start = html.indexOf('<section class="section glass" id="section-game">');
if (start === -1) {
  console.error('section-game not found');
  process.exit(1);
}

let depth = 0;
let i = start;
while (i < html.length) {
  const open = html.indexOf('<section', i);
  const close = html.indexOf('</section>', i);
  if (close === -1) break;
  if (open !== -1 && open < close) {
    depth += 1;
    i = open + 8;
    continue;
  }
  depth -= 1;
  i = close + 10;
  if (depth === 0) {
    const fragment = html.slice(start, i);
    const out = path.join(__dirname, '..', 'jugar', 'game-section.fragment.html');
    fs.writeFileSync(out, fragment, 'utf8');
    console.log('Wrote', out, fragment.length, 'chars');
    process.exit(0);
  }
}

console.error('Could not close section-game');
process.exit(1);
