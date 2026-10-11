'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const R = require('../assets/rules.js');
const { loadDataset } = require('../scripts/build-data.js');

const ROOT = path.join(__dirname, '..');
const { ds, config } = loadDataset();
const rawRows = R.parseCsv(fs.readFileSync(path.join(ROOT, 'data/source/bhopal_ghats_2023_2025.csv'), 'utf8'));
const criteria = R.parseCsv(fs.readFileSync(path.join(ROOT, 'data/source/cpcb_water_quality_criteria.csv'), 'utf8'));

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function byName(list, name) { return list.find((a) => a.ghat.name === name); }

// ---------- Headline statistics (participant guide) ----------

test('headline: 42 of 116 measured DO readings are below 5 mg/l', () => {
  const s = R.headlineStats(ds);
  assert.equal(s.doMeasured, 116);
  assert.equal(s.doBelowB, 42);
});

test('headline: 100 of 112 measured BOD readings are above 3 mg/l', () => {
  const s = R.headlineStats(ds);
  assert.equal(s.bodMeasured, 112);
  assert.equal(s.bodAboveB, 100);
});

test('headline: exactly 4 zero-DO readings, all Bairagarh, with their source pages', () => {
  const zeros = R.headlineStats(ds).doZero.map((r) => [r.site, r.year, r.festival, r.phase, r.page]);
  assert.deepEqual(zeros, [
    ['Bairagarh (Sant Hirdaram) kund', '2023', 'Ganesh', 'after', 26],
    ['Bairagarh (Sant Hirdaram) kund', '2023', 'Durga', 'pre', 60],
    ['Bairagarh (Sant Hirdaram) kund', '2023', 'Durga', 'during', 60],
    ['Bairagarh (Sant Hirdaram) kund', '2025', 'Ganesh', 'during', 28]
  ]);
});

test('headline: 32 of 37 pre-immersion BOD readings already above 3 mg/l', () => {
  const s = R.headlineStats(ds);
  assert.equal(s.bodPreMeasured, 37);
  assert.equal(s.bodPreAboveB, 32);
});

// ---------- Thresholds come from the CPCB file ----------

test('thresholds are read from the CPCB criteria file', () => {
  const th = R.thresholdsFromCriteria(criteria);
  assert.deepEqual(th.classB.pH, { min: 6.5, max: 8.5, unit: '' });
  assert.equal(th.classB['Dissolved oxygen'].min, 5);
  assert.equal(th.classB.BOD.max, 3);
  assert.equal(th.doSevere, 4);
  assert.equal(th.conductivityClassE, 2250);
});

test('parameters with no Class B limit are never graded as failures', () => {
  for (const r of ds.readings) {
    if (!R.CLASS_B_PARAMS.includes(r.parameter) && r.status === 'measured') {
      assert.equal(R.grade(r, ds.thresholds), 'nolimit', r.parameter);
    }
  }
});

// ---------- Parsing and flags ----------

test('all 1,524 rows load, each with a status', () => {
  assert.equal(ds.readings.length, 1524);
  const c = R.headlineStats(ds).statusCounts;
  assert.deepEqual(c, { measured: 1289, bdl: 174, not_sampled: 61 });
});

test('BDL is never turned into zero or into missing', () => {
  const bdl = ds.readings.filter((r) => r.status === 'bdl');
  assert.equal(bdl.length, 174);
  for (const r of bdl) {
    assert.equal(r.value, null);
    assert.equal(r.printed, 'BDL');
    assert.equal(R.grade(r, ds.thresholds), null);
  }
});

test('blank, _, * and ** become not_sampled and keep the printed symbol', () => {
  const ns = ds.readings.filter((r) => r.status === 'not_sampled');
  const printed = [...new Set(ns.map((r) => r.printed))].sort();
  assert.deepEqual(printed, ['', '*', '**', '_']);
  for (const r of ns) assert.equal(r.value, null);
});

test('ND is kept as its own status, separate from BDL and not sampled', () => {
  const raw = Object.assign({}, rawRows.find((r) => r.parameter === 'Lead'), { value: '', flag: 'ND', value_as_printed: 'ND' });
  const r = R.normaliseReading(raw, 0);
  assert.equal(r.status, 'nd');
  assert.equal(r.value, null);
});

test('an unknown flag stops the build instead of being guessed', () => {
  const raw = Object.assign({}, rawRows[0], { value: '', flag: 'n/a', value_as_printed: 'n/a' });
  assert.throws(() => R.normaliseReading(raw, 0), /unknown flag/);
});

test('BDL on a Class B parameter needs manual review', () => {
  const raw = Object.assign({}, rawRows.find((r) => r.parameter === 'BOD'), { value: '', flag: 'BDL', value_as_printed: 'BDL' });
  assert.throws(() => R.normaliseReading(raw, 0), /manual review/);
});

test('the source CSV values are preserved exactly', () => {
  rawRows.forEach((raw, i) => {
    const r = ds.readings[i];
    assert.equal(r.printed, raw.value_as_printed.trim());
    assert.equal(r.sitePrinted, raw.site_as_printed);
    assert.equal(r.page, Number(raw.source_page));
    if (raw.value !== '') assert.equal(r.value, Number(raw.value));
  });
});

// ---------- Missing events ----------

test('exactly two missing events: Bairagarh and Malikhedi, Durga 2025', () => {
  assert.deepEqual(R.missingEvents(ds), [
    { site: 'Bairagarh (Sant Hirdaram) kund', year: '2025', festival: 'Durga' },
    { site: 'Malikhedi kund', year: '2025', festival: 'Durga' }
  ]);
  const present = ds.ghats.reduce((n, g) => n + R.eventsFor(g.name, ds.readings, ds.years).filter((e) => e.status !== 'missing').length, 0);
  assert.equal(present, 40);
});

// ---------- Ranking ----------

test('ranking table matches the approved method exactly', () => {
  const got = R.assessAll(ds, config.newGhats).map((a) => [a.rank, a.joint, a.ghat.name, a.evidence, a.confidence, a.lane, a.gaps.map((g) => g.code).join(',')]);
  assert.deepEqual(got, [
    [1, false, 'Bairagarh (Sant Hirdaram) kund', 'HIGH', 'GAPS', 'act_verify', 'G1,G2'],
    [2, false, 'Malikhedi kund', 'HIGH', 'GAPS', 'act_verify', 'G1,G2'],
    [3, true, 'Rani Kamlapati ghat / Kamla Park kund', 'HIGH', 'GAPS', 'act_verify', 'G3'],
    [3, true, 'Shahpura lake ghat', 'HIGH', 'ADEQUATE', 'act', ''],
    [5, false, 'Prempura ghat', 'MEDIUM', 'ADEQUATE', 'watch', ''],
    [6, true, 'Hathaikheda dam / kund', 'MEDIUM', 'ADEQUATE', 'watch', ''],
    [6, true, 'Khatlapura ghat', 'MEDIUM', 'ADEQUATE', 'watch', ''],
    [null, false, 'New BMC immersion ghats', 'NONE', 'GAPS', 'baseline', 'G0']
  ]);
});

test('persistent BOD failures are reported for every ghat, including Watch ghats', () => {
  const list = R.assessAll(ds);
  const bod = Object.fromEntries(list.map((a) => [a.ghat.name, [a.bod.above, a.bod.measured, a.bod.preAbove, a.bod.preMeasured]]));
  assert.deepEqual(bod['Hathaikheda dam / kund'], [16, 18, 5, 6]);
  assert.deepEqual(bod['Khatlapura ghat'], [15, 17, 5, 6]);
  const total = list.reduce((n, a) => n + a.bod.above, 0);
  assert.equal(total, 100);
});

test('a ghat with no readings is "establish baseline", never Routine, and unranked', () => {
  const ghat = { id: 'x', name: 'Unsampled test ghat', siteMatch: 'high' };
  const a = R.assessGhat(ghat, ds.readings, ds.years, ds.thresholds);
  assert.equal(a.evidence, 'NONE');
  assert.equal(a.lane, 'baseline');
  assert.equal(R.rankAll([a])[0].rank, null);
});

test('a ghat whose rows are all "not sampled" is treated as having no readings', () => {
  const rows = ds.readings.filter((r) => r.site === 'Khatlapura ghat').map((r) => Object.assign({}, r, { site: 'Blank ghat', status: 'not_sampled', value: null }));
  const a = R.assessGhat({ id: 'b', name: 'Blank ghat', siteMatch: 'high' }, rows, ds.years, ds.thresholds);
  assert.equal(a.evidence, 'NONE');
  assert.equal(a.lane, 'baseline');
});

test('blanking any single reading never adds a pass and never yields Routine', () => {
  const th = ds.thresholds;
  const passes = (rs) => rs.filter((r) => R.grade(r, th) === 'pass').length;
  for (const g of ds.ghats) {
    const own = ds.readings.filter((r) => r.site === g.name);
    const basePasses = passes(own);
    for (const r of own) {
      if (r.status !== 'measured') continue;
      const mutated = own.map((x) => (x === r ? Object.assign({}, x, { status: 'not_sampled', value: null }) : x));
      assert.ok(passes(mutated) <= basePasses);
      const a = R.assessGhat(g, mutated, ds.years, th);
      assert.notEqual(a.lane, 'routine', g.name + ' row ' + r.id);
      if (r.year === '2025' && R.CLASS_B_PARAMS.includes(r.parameter)) {
        assert.equal(a.confidence, 'GAPS', 'removing a 2025 Class B reading must show a gap: ' + g.name + ' row ' + r.id);
      }
    }
  }
});

test('changing confidence alone never changes the ranking order', () => {
  const base = R.assessAll(ds).map((a) => [a.ghat.name, a.rank]);
  const flipped = clone(ds);
  flipped.ghats.forEach((g) => { g.siteMatch = g.siteMatch === 'high' ? 'medium' : 'high'; });
  const after = R.assessAll(flipped).map((a) => [a.ghat.name, a.rank]);
  assert.deepEqual(after, base);
  const lanes = Object.fromEntries(R.assessAll(flipped).map((a) => [a.ghat.name, a.lane]));
  assert.equal(lanes['Shahpura lake ghat'], 'act_verify'); // confidence changes the action, not the order
});

// ---------- Source links ----------

test('every reading has a page inside its report and the link points to the right PDF', () => {
  for (const r of ds.readings) {
    const rep = R.REPORTS[r.year];
    assert.ok(r.page >= 1 && r.page <= rep.pages, 'page ' + r.page + ' in ' + rep.file);
    assert.equal(R.sourceLink(r.year, r.page), 'reports/' + rep.file + '#page=' + r.page);
    assert.ok(fs.existsSync(path.join(ROOT, 'reports', rep.file)), rep.file);
  }
});

test('page counts used for validation match the PDF files on disk', () => {
  for (const y of Object.keys(R.REPORTS)) {
    const buf = fs.readFileSync(path.join(ROOT, 'reports', R.REPORTS[y].file)).toString('latin1');
    const pages = (buf.match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.equal(pages, R.REPORTS[y].pages, R.REPORTS[y].file);
  }
});

test('an out-of-range source page stops the build', () => {
  const raw = Object.assign({}, rawRows[0], { source_page: '999' });
  assert.throws(() => R.normaliseReading(raw, 0), /outside/);
});
