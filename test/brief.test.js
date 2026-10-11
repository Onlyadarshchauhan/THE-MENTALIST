'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../assets/rules.js');
const B = require('../assets/brief.js');
const { loadDataset } = require('../scripts/build-data.js');

const { ds, config } = loadDataset();
const assessed = R.assessAll(ds, config.newGhats);
const stats = R.headlineStats(ds);
const plans = { en: B.buildPlan(assessed, stats, 'en'), hi: B.buildPlan(assessed, stats, 'hi') };

function allText(plan) {
  return [plan.title, plan.subtitle, plan.headline, plan.method, plan.samplingTitle, plan.limitsTitle, plan.footer]
    .concat(plan.sampling, plan.limits)
    .concat(...plan.rows.map((r) => [r.name, r.lane, r.reason].concat(r.actions)))
    .join('\n');
}

test('both plans list every ghat in the same order with the same ranks', () => {
  assert.deepEqual(plans.en.rows.map((r) => [r.id, r.rank, r.laneKey]), plans.hi.rows.map((r) => [r.id, r.rank, r.laneKey]));
  assert.deepEqual(plans.en.rows.map((r) => r.rank), ['1', '2', '=3', '=3', '5', '=6', '=6', '–']);
});

test('English plan carries the required caveats', () => {
  const t = allText(plans.en);
  for (const s of ['historical', 'not live monitoring', 'Coliform', 'not been verified', 'NGT', 'not an official MPPCB or BMC classification', 'Class B', 'units']) {
    assert.ok(t.includes(s), 'missing caveat: ' + s);
  }
});

test('Hindi plan carries the same caveats', () => {
  const t = allText(plans.hi);
  for (const s of ['ऐतिहासिक', 'लाइव निगरानी नहीं', 'कोलीफॉर्म', 'पुष्टि नहीं', 'एनजीटी', 'आधिकारिक वर्गीकरण नहीं', 'श्रेणी B', 'इकाइयाँ']) {
    assert.ok(t.includes(s), 'missing caveat: ' + s);
  }
  assert.equal(plans.hi.limits.length, plans.en.limits.length);
});

test('priority ghats and their key actions appear in both plans', () => {
  for (const lang of ['en', 'hi']) {
    const rows = plans[lang].rows;
    const bair = rows.find((r) => r.id === 'bairagarh-sant-hirdaram-kund');
    assert.equal(bair.rank, '1');
    assert.ok(bair.actions.length >= 3, lang + ': Bairagarh needs cleaning, sampling and pre-immersion actions');
    assert.ok(bair.pages.length >= 1);
    const rani = rows.find((r) => r.id === 'rani-kamlapati-ghat-kamla-park-kund');
    assert.ok(rani.identityWarning);
    assert.ok(rani.actions.some((x) => x.includes(lang === 'hi' ? 'कमला पार्क' : 'Kamla Park')));
    const newG = rows.find((r) => r.id === 'new-bmc-ghats');
    assert.equal(newG.laneKey, 'baseline');
  }
});

test('missing Durga 2025 tables are stated in the actions for Bairagarh and Malikhedi', () => {
  for (const id of ['bairagarh-sant-hirdaram-kund', 'malikhedi-kund']) {
    assert.ok(plans.en.rows.find((r) => r.id === id).actions.some((x) => x.includes('no Durga table')));
    assert.ok(plans.hi.rows.find((r) => r.id === id).actions.some((x) => x.includes('दुर्गा तालिका नहीं')));
  }
});

test('Watch ghats still show their BOD failures', () => {
  for (const id of ['hathaikheda-dam-kund', 'khatlapura-ghat', 'prempura-ghat']) {
    assert.match(plans.en.rows.find((r) => r.id === id).reason, /BOD above 3 mg\/l in \d+ of \d+/);
  }
});

test('no unsupported claims in either plan or the short text', () => {
  for (const lang of ['en', 'hi']) {
    assert.deepEqual(B.unsupportedClaims(allText(plans[lang])), [], lang);
    assert.deepEqual(B.unsupportedClaims(B.planToText(plans[lang])), [], lang + ' text');
  }
});

test('claim checker rejects unsupported claims but allows "not live monitoring"', () => {
  assert.deepEqual(B.unsupportedClaims('This is not live monitoring.'), []);
  assert.deepEqual(B.unsupportedClaims('यह लाइव निगरानी नहीं है।'), []);
  assert.ok(B.unsupportedClaims('The water is safe for bathing.').length);
  assert.ok(B.unsupportedClaims('Live readings from the ghat').length);
  assert.ok(B.unsupportedClaims('This causes disease.').length);
  assert.ok(B.unsupportedClaims('We predict DO will fall.').length);
  assert.ok(B.unsupportedClaims('पानी सुरक्षित है').length);
});

test('every detailed reason that cites readings links to real pages', () => {
  for (const a of assessed) {
    for (const r of B.reasons(a)) {
      for (const ref of r.refs) assert.ok(ref.page >= 1 && R.REPORTS[ref.year], a.ghat.name);
    }
  }
});
