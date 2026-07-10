/* ============================================================================
   BRTV 原型 · 单文件打包器
   把 index.html(启动壳) + 5 个工作台 + 共享 CSS/数据/图标 + React 运行时
   合并成「一个」自包含 HTML：
   - 每个工作台的 CSS / React / ReactDOM / 数据 / 图标 全部内联
   - JSX 在打包时用 Babel 预编译成普通 JS（运行时不再需要 2.8MB 的 babel.min.js）
   - 每个工作台作为 srcdoc 内联进启动壳，切换器改用 iframe.srcdoc
   产物零外部依赖，file:// 双击即开，可直接发送。

   用法：node prototype-brtv/build-single.cjs
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const A = p => path.join(DIR, p);
const read = p => fs.readFileSync(A(p), 'utf8');

/* —— 载入 Babel standalone 用于 JSX 预编译 —— */
const babelPath = A('assets/vendor/babel.min.js');
let Babel;
try {
  Babel = require(babelPath);
  if (!Babel || !Babel.transform) throw new Error('no transform');
} catch (e) {
  const vm = require('vm');
  const sandbox = {};
  sandbox.self = sandbox; sandbox.window = sandbox; sandbox.global = sandbox;
  sandbox.module = { exports: {} }; sandbox.exports = sandbox.module.exports;
  sandbox.navigator = { userAgent: 'node' };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(babelPath, 'utf8'), sandbox);
  Babel = sandbox.Babel || sandbox.module.exports;
}
if (!Babel || !Babel.transform) { console.error('✗ 无法载入 Babel'); process.exit(1); }

/* —— 共享资源 —— */
const css = read('assets/brtv-design.css');
const reactJs = read('assets/vendor/react.production.min.js');
const reactDomJs = read('assets/vendor/react-dom.production.min.js');
const dataJs = read('assets/brtv-data.js');
const iconsJs = read('assets/brtv-icons.js');

/* —— 工具：把 JS 安全内联进 <script>（转义 </script>）—— */
const safeJs = s => s.replace(/<\/script/gi, '<\\/script');
const inlineScript = s => '<script>' + safeJs(s) + '</script>';
// 关键：替换值用「函数」形式，避免压缩代码里的 $& / $' / $` 被当成 replace 特殊模式
const lit = v => () => v;

/* —— 把单个工作台 HTML 变成完全自包含 —— */
function selfContain(file) {
  let html = read(file);
  html = html.replace('<link rel="stylesheet" href="assets/brtv-design.css">', lit('<style>\n' + css + '\n</style>'));
  html = html.replace('<script src="assets/vendor/react.production.min.js"></script>', lit(inlineScript(reactJs)));
  html = html.replace('<script src="assets/vendor/react-dom.production.min.js"></script>', lit(inlineScript(reactDomJs)));
  html = html.replace('<script src="assets/vendor/babel.min.js"></script>', '');   // 预编译后不再需要
  html = html.replace('<script src="assets/brtv-data.js"></script>', lit(inlineScript(dataJs)));
  html = html.replace('<script src="assets/brtv-icons.js"></script>', lit(inlineScript(iconsJs)));
  // 预编译 text/babel
  let transpiled = false;
  html = html.replace(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/, (m, code) => {
    transpiled = true;
    const out = Babel.transform(code, { presets: ['react'] }).code;
    return inlineScript(out);
  });
  if (!transpiled) console.warn('  ⚠ 未找到 text/babel 脚本:', file);
  // 校验：不应再有任何 assets/ 外链
  const leftover = (html.match(/(src|href)="assets\//g) || []).length;
  if (leftover) console.warn('  ⚠', file, '仍残留', leftover, '个 assets/ 外链');
  return html;
}

const platforms = ['cowork', 'pc', 'app', 'im'];
const built = {};
for (const p of platforms) { built[p] = selfContain(p + '.html'); console.log('  ✓ 自包含:', p + '.html', (Buffer.byteLength(built[p]) / 1024).toFixed(0) + ' KB'); }

/* —— 组装启动壳 —— */
let launcher = read('index.html');
launcher = launcher.replace('<link rel="stylesheet" href="assets/brtv-design.css">', lit('<style>\n' + css + '\n</style>'));

// PLATFORMS 对象：每个工作台 HTML 作为 JSON 字符串（再转义 </script> 防止提前闭合外层脚本）
const enc = s => JSON.stringify(s).replace(/<\/script/gi, '<\\/script');
const platformsLiteral = '{' + platforms.map(p => p + ':' + enc(built[p])).join(',') + '}';

// 内联图标 + 注入 PLATFORMS（在启动壳主脚本之前）—— 用函数形式避免 $ 特殊模式
launcher = launcher.replace('<script src="assets/brtv-icons.js"></script>',
  lit(inlineScript(iconsJs) + '\n<script>window.PLATFORMS=' + platformsLiteral + ';</script>'));

// 切换器：iframe 改用 srcdoc（不再加载兄弟文件）
launcher = launcher.replace('<iframe id="frame" src="cowork.html" title="BRTV 工作台"></iframe>',
  lit('<iframe id="frame" title="BRTV 工作台"></iframe>'));
launcher = launcher.replace("const frame=document.getElementById('frame');",
  lit("const frame=document.getElementById('frame');frame.srcdoc=window.PLATFORMS.cowork;"));
launcher = launcher.replace('frame.src=el.dataset.src;',
  lit("frame.srcdoc=window.PLATFORMS[el.dataset.src.replace('.html','')];"));

// 最终校验：启动壳里除 PLATFORMS 内嵌内容外，不应再有 assets/ 外链
const launcherLeftover = (launcher.replace(platformsLiteral, '').match(/(src|href)="assets\//g) || []).length;
if (launcherLeftover) console.warn('  ⚠ 启动壳仍残留', launcherLeftover, '个 assets/ 外链');

const outName = 'BRTV-智能交互工作台-单文件.html';
const outPath = A(outName);
fs.writeFileSync(outPath, launcher, 'utf8');
console.log('\n✓ 单文件已生成: prototype-brtv/' + outName);
console.log('  大小: ' + (Buffer.byteLength(launcher) / 1024 / 1024).toFixed(2) + ' MB');
console.log('  零外部依赖 · 双击即可在浏览器打开');
