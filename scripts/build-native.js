const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');
const copyTargets = [
  'index.html',
  'install.html',
  'manifest.webmanifest',
  'pages',
  'src',
  'assets'
];

function rm(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) copy(path.join(src, item), path.join(dest, item));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

rm(out);
fs.mkdirSync(out, { recursive: true });
for (const target of copyTargets) {
  const src = path.join(root, target);
  if (fs.existsSync(src)) copy(src, path.join(out, target));
}

const nativeConfig = {
  builtAt: new Date().toISOString(),
  mode: 'capacitor-native',
  note: 'AI 对话在原生 App 中默认读取 window.MORANDI_AI_PROXY_URL 或 localStorage.morandi_ai_proxy_url。请使用 HTTPS 后端代理，不要把 DeepSeek Key 写进前端。'
};
fs.writeFileSync(path.join(out, 'native-config.json'), JSON.stringify(nativeConfig, null, 2));
console.log('✅ Native web assets generated in ./www');
