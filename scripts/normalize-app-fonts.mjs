import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const write = process.argv.includes('--write');
const check = process.argv.includes('--check') || !write;
const ignored = new Set(['.git', 'node_modules', 'test-results', 'playwright-report']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function relativeFontHref(file) {
  let href = path.relative(path.dirname(file), path.join(root, 'assets', 'app-fonts.css')).replaceAll(path.sep, '/');
  if (!href.startsWith('.')) href = './' + href;
  return href;
}

let changed = 0;
let missing = 0;
for (const file of walk(root)) {
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes('app-fonts.css')) continue;
  missing++;
  const href = relativeFontHref(file);
  const tag = `\n<!-- Global Vietnamese/CJK-safe font stack -->\n<link rel="stylesheet" href="${href}">\n`;
  if (!source.includes('</head>')) {
    console.error(`No </head> found: ${path.relative(root, file)}`);
    continue;
  }
  if (write) {
    source = source.replace('</head>', `${tag}</head>`);
    fs.writeFileSync(file, source);
    changed++;
    console.log(`font: ${path.relative(root, file)} -> ${href}`);
  }
}

// Canvas text does not inherit CSS fonts. Normalize known Xiangqi canvas stacks too.
const canvasFiles = [
  path.join(root, 'games', 'three-kingdoms-xiangqi-ui.js'),
  path.join(root, 'games', 'xiangqi-core.html'),
];
for (const file of canvasFiles) {
  if (!fs.existsSync(file)) continue;
  let source = fs.readFileSync(file, 'utf8');
  const original = source;
  source = source
    .replaceAll('"Noto Serif CJK SC","Songti SC",serif', '"Noto Sans SC","Noto Sans","Microsoft YaHei","PingFang SC",sans-serif')
    .replaceAll('px serif`', 'px "Noto Sans SC","Noto Sans","Microsoft YaHei","PingFang SC",sans-serif`')
    .replaceAll("'700 22px Segoe UI, sans-serif'", "'700 22px Noto Sans SC, Noto Sans, Microsoft YaHei, PingFang SC, sans-serif'")
    .replaceAll("'800 24px \"Microsoft YaHei\", \"PingFang SC\", sans-serif'", "'800 24px Noto Sans SC, Noto Sans, Microsoft YaHei, PingFang SC, sans-serif'");
  if (source !== original && write) {
    fs.writeFileSync(file, source);
    changed++;
    console.log(`canvas-font: ${path.relative(root, file)}`);
  }
}

if (write) {
  console.log(`Normalized ${changed} files.`);
} else if (check && missing > 0) {
  console.error(`${missing} HTML files are missing assets/app-fonts.css.`);
  process.exitCode = 1;
}
