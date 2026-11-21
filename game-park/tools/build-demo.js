/* 把 minigame/ 的 CommonJS 源码打包成浏览器可直接运行的 demo/bundle.js
 * 用法：node tools/build-demo.js
 * 无第三方依赖；bundle 保留原文件路径，require 按相对路径解析，与微信小游戏运行时语义一致。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'minigame');
const OUT = path.join(__dirname, '..', 'demo', 'bundle.js');

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.js')) files.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
})(ROOT);
files.sort();

let out = `// 本文件由 node tools/build-demo.js 自动生成，请勿手改
// 源码目录：minigame/
const __modules = {};

function __norm(baseDir, p) {
  const stack = baseDir && baseDir !== '.' ? baseDir.split('/') : [];
  for (const seg of p.split('/')) {
    if (seg === '..') stack.pop();
    else if (seg === '.' || seg === '') continue;
    else stack.push(seg);
  }
  return stack.join('/') || '.';
}

function __define(id, dir, factory) {
  __modules[id] = { dir, factory, exports: null, loaded: false };
}

function __get(id) {
  const m = __modules[id];
  if (!m) throw new Error('module not found: ' + id);
  if (!m.loaded) {
    m.loaded = true;
    const module = { exports: {} };
    m.factory(function (p) { return __get(__resolve(p, id)); }, module, module.exports);
    m.exports = module.exports;
  }
  return m.exports;
}

function __resolve(p, fromId) {
  const dir = __modules[fromId].dir;
  let combined = __norm(dir, p);
  if (!__modules[combined]) {
    if (__modules[combined + '.js']) return combined + '.js';
    throw new Error('module not found: ' + p + ' (from ' + fromId + ')');
  }
  return combined;
}
`;

for (const f of files) {
  const dir = path.dirname(f).replace(/\\/g, '/');
  const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
  out += `__define(${JSON.stringify(f)}, ${JSON.stringify(dir)}, function (require, module, exports) {\n${content}\n});\n`;
}

out += `\n__get("game.js");\n`;

fs.writeFileSync(OUT, out, 'utf8');
console.log(`bundle ok: ${files.length} modules -> ${path.relative(path.join(__dirname, '..'), OUT)}`);
