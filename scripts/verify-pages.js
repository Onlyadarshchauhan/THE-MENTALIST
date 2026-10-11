#!/usr/bin/env node
// Developer check: for every measured DO, BOD and pH reading, confirm that the
// value as printed appears on the cited PDF page. Needs pdftotext (Poppler).
// Reports a match rate; it does not claim certainty (a number can appear on a
// page for other reasons, and table layout can split text).
//   node scripts/verify-pages.js
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const R = require('../assets/rules.js');
const { loadDataset } = require('./build-data.js');

const ROOT = path.join(__dirname, '..');
const { ds } = loadDataset();
const cache = {};
function pageText(year, page) {
  const k = year + ':' + page;
  if (!(k in cache)) {
    cache[k] = execFileSync('pdftotext', ['-layout', '-f', String(page), '-l', String(page), path.join(ROOT, 'reports', R.REPORTS[year].file), '-'], { encoding: 'utf8' });
  }
  return cache[k];
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const checked = ds.readings.filter((r) => r.status === 'measured' && R.CLASS_B_PARAMS.includes(r.parameter));
const misses = [];
for (const r of checked) {
  const text = pageText(r.year, r.page);
  const site = r.sitePrinted.split(/[ ,(]/).find((w) => w.length > 4) || '';
  const valueFound = new RegExp('(^|[^0-9.])' + esc(r.printed) + '($|[^0-9])', 'm').test(text);
  const siteFound = !site || text.toLowerCase().includes(site.toLowerCase());
  if (!valueFound || !siteFound) misses.push(r);
}
console.log('Checked ' + checked.length + ' measured DO/BOD/pH readings against their cited page.');
console.log('Value and site name found on cited page: ' + (checked.length - misses.length) + ' / ' + checked.length);
misses.forEach((r) => console.log('  not found: ' + [r.site, r.year, r.festival, r.phase, r.parameter, '"' + r.printed + '"', 'p.' + r.page].join(' | ')));
process.exit(misses.length ? 1 : 0);
