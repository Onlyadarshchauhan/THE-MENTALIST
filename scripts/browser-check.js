#!/usr/bin/env node
// Developer check: opens index.html in headless Chrome or Edge, visits every
// screen, fails on any JavaScript error, checks every PDF link, and saves
// screenshots. No packages: uses the DevTools protocol over Node's WebSocket.
//   node scripts/browser-check.js [screenshot-dir]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const R = require('../assets/rules.js');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(os.tmpdir(), 'vgw-screens');
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const exe = CANDIDATES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Chrome or Edge found. Set CHROME=path/to/browser');
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vgw-profile-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile, '--window-size=1366,900', 'about:blank'], { stdio: 'ignore' });

  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); break; } catch (e) { await sleep(200); }
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = {}; const errors = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value || a.description).join(' '));
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');

  const base = pathToFileURL(path.join(ROOT, 'index.html')).href;
  const ids = await (async () => {
    await send('Page.navigate', { url: base }); await sleep(1200);
    return evalJs('Object.keys((function(){var o={};document.querySelectorAll(".gcard").forEach(function(a){o[a.getAttribute("href").split("/").pop()]=1});return o;})())');
  })();
  const screens = [['board', '#/'], ['method', '#/method'], ['plan', '#/plan']].concat(ids.map((g) => ['ghat-' + g, '#/ghat/' + g]));
  const report = [];
  const links = new Set();
  for (const [name, hash] of screens) {
    await send('Page.navigate', { url: base + hash }); await sleep(700);
    const info = await evalJs('({h1: (document.querySelector("h1")||{}).textContent, pdf: Array.from(document.querySelectorAll("a[href*=\\".pdf\\"]")).map(function(a){return a.getAttribute("href")})})');
    info.pdf.forEach((l) => links.add(l));
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: await fullClip() });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(shot.result.data, 'base64'));
    report.push(name.padEnd(46) + ' h1="' + (info.h1 || '').trim().slice(0, 60) + '" pdf-links=' + info.pdf.length);
  }
  // Interaction checks: insight modal, filters, language toggle
  await send('Page.navigate', { url: base + '#/' }); await sleep(600);
  const modalRows = await evalJs('document.querySelector("[data-insight=prebod]").click(); document.querySelectorAll("#modal-body tr").length - 1');
  await send('Page.navigate', { url: base + '#/ghat/bairagarh-sant-hirdaram-kund' }); await sleep(600);
  const filtered = await evalJs('var s=document.querySelector("select[name=festival]"); s.value="Durga"; s.dispatchEvent(new Event("change")); document.querySelectorAll("#grid thead th, #grid tr:first-child th").length');
  await send('Page.navigate', { url: base + '#/plan' }); await sleep(600);
  const docs = await evalJs('document.querySelector("[data-lang=hi]").click(); [document.querySelectorAll(".doc").length, document.querySelector(".doc").getAttribute("lang")]');

  ws.close(); proc.kill();

  // Every PDF link must point to an existing report and an in-range page.
  const bad = [];
  for (const l of links) {
    const m = l.match(/^reports\/([^#]+)(?:#page=(\d+))?$/);
    const rep = m && Object.values(R.REPORTS).find((r) => r.file === m[1]);
    if (!rep || !fs.existsSync(path.join(ROOT, 'reports', m[1])) || (m[2] && (+m[2] < 1 || +m[2] > rep.pages))) bad.push(l);
  }
  console.log(report.join('\n'));
  console.log('insight modal rows: ' + modalRows + ' · Durga filter header cells: ' + filtered + ' · plan docs after Hindi toggle: ' + JSON.stringify(docs));
  console.log('distinct PDF links: ' + links.size + ', broken: ' + bad.length + (bad.length ? ' ' + bad.join(' ') : ''));
  console.log('JavaScript errors: ' + errors.length + (errors.length ? '\n  ' + errors.join('\n  ') : ''));
  console.log('screenshots: ' + OUT);
  if (errors.length || bad.length || modalRows !== 37 || docs[0] !== 1 || docs[1] !== 'hi') process.exit(1);

  async function fullClip() {
    const m = await send('Page.getLayoutMetrics');
    const c = m.result.cssContentSize || m.result.contentSize;
    return { x: 0, y: 0, width: 1366, height: Math.min(Math.ceil(c.height), 6000), scale: 1 };
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
