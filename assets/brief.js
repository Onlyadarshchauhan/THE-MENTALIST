/*
 * Visarjan Ghat Watch: plain-language reasons, suggested actions and the
 * bilingual Pre-Visarjan Action Plan. Fixed templates filled from the rules;
 * no AI text generation. Runs in the browser (window.VGWBrief) and in Node.
 *
 * The Hindi is a faithful translation of the English templates. It should be
 * reviewed by a native speaker before official use (see README).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VGWBrief = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VISARJAN = '20 October 2026';
  var VISARJAN_HI = '20 अक्टूबर 2026';

  var NAMES_HI = {
    'Bairagarh (Sant Hirdaram) kund': 'बैरागढ़ (संत हिरदाराम) कुंड',
    'Malikhedi kund': 'मालीखेड़ी कुंड',
    'Rani Kamlapati ghat / Kamla Park kund': 'रानी कमलापति घाट / कमला पार्क कुंड',
    'Shahpura lake ghat': 'शाहपुरा झील घाट',
    'Prempura ghat': 'प्रेमपुरा घाट',
    'Hathaikheda dam / kund': 'हथाईखेड़ा डैम / कुंड',
    'Khatlapura ghat': 'खटलापुरा घाट',
    'New BMC immersion ghats': 'बीएमसी के नए विसर्जन घाट'
  };

  var LANES = {
    act_verify: { en: 'Act and verify', hi: 'कार्रवाई करें और जाँच कराएँ' },
    act: { en: 'Act', hi: 'कार्रवाई करें' },
    verify: { en: 'Verify first', hi: 'पहले जाँच कराएँ' },
    watch: { en: 'Watch', hi: 'निगरानी रखें' },
    routine: { en: 'Routine', hi: 'नियमित निगरानी' },
    baseline: { en: 'Establish baseline', hi: 'आधार जाँच कराएँ' }
  };
  var LANE_ORDER = ['act_verify', 'act', 'verify', 'watch', 'routine', 'baseline'];

  var FEST_HI = { Durga: 'दुर्गा', Ganesh: 'गणेश' };
  var PHASE = {
    pre: { en: 'before immersion', hi: 'विसर्जन से पहले' },
    during: { en: 'during immersion', hi: 'विसर्जन के दौरान' },
    after: { en: 'one week after', hi: 'एक सप्ताह बाद' }
  };

  function nameIn(a, lang) { return lang === 'hi' ? (NAMES_HI[a.ghat.name] || a.ghat.name) : a.ghat.name; }
  function evLabel(e, lang) { return lang === 'hi' ? FEST_HI[e.festival] + ' ' + e.year : e.festival + ' ' + e.year; }
  function pageRef(e, lang) { return e.year + (lang === 'hi' ? ' पृ. ' : ' p.') + e.page; }
  function list(items, lang) {
    if (items.length <= 1) return items.join('');
    var and = lang === 'hi' ? ' और ' : ' and ';
    return items.slice(0, -1).join(', ') + and + items[items.length - 1];
  }

  // ---------- One-line reason (plan table) ----------

  function shortReason(a, lang) {
    var hi = lang === 'hi';
    if (a.evidence === 'NONE') {
      return hi ? '2023–2025 की एमपीपीसीबी रिपोर्टों में कोई रीडिंग नहीं।' : 'No MPPCB readings in the 2023–2025 reports.';
    }
    var parts = [];
    var n = a.doSevereEvents.length, m = a.sampledCount, z = a.doZeroEvents.length;
    if (n > 0) {
      if (hi) {
        parts.push('घुलित ऑक्सीजन (DO) 4 mg/l से कम: ' + m + ' में से ' + n + ' जाँच-अवसरों में' +
          (z ? ' (' + z + ' बार शून्य दर्ज)' : '') +
          (a.latestDurgaSevere ? ', नवीनतम उपलब्ध दुर्गा रिकॉर्ड (' + a.latestDurga.year + ') सहित' : ''));
      } else {
        parts.push('DO below 4 mg/l in ' + n + ' of ' + m + ' sampled events' +
          (z ? ' (zero recorded in ' + z + ')' : '') +
          (a.latestDurgaSevere ? ', including the most recent Durga record (' + a.latestDurga.year + ')' : ''));
      }
    } else {
      parts.push(hi ? 'DO कभी 4 mg/l से कम दर्ज नहीं' : 'DO never recorded below 4 mg/l');
    }
    parts.push(hi
      ? 'बीओडी (BOD) 3 mg/l से अधिक: ' + a.bod.measured + ' में से ' + a.bod.above + ' रीडिंग'
      : 'BOD above 3 mg/l in ' + a.bod.above + ' of ' + a.bod.measured + ' readings');
    return parts.join(hi ? '; ' : '; ') + (hi ? '।' : '.');
  }

  // ---------- Detailed reasons (case file) ----------
  // Each reason carries the readings it rests on so the UI can link them to the PDF page.

  function reasons(a) {
    var out = [];
    if (a.evidence === 'NONE') {
      out.push({ kind: 'gap', text: 'No MPPCB readings exist for this site in the 2023–2025 reports. Missing data is not evidence of clean water.', refs: [] });
      return out;
    }
    if (a.doZeroEvents.length) {
      var zr = [];
      a.doZeroEvents.forEach(function (e) { e.doZero.forEach(function (f) { zr.push(f.reading); }); });
      out.push({ kind: 'critical', text: 'Zero dissolved oxygen recorded ' + zr.length + ' time' + (zr.length > 1 ? 's' : '') + ' across ' + a.doZeroEvents.length + ' event' + (a.doZeroEvents.length > 1 ? 's' : '') + '.', refs: zr });
    }
    if (a.doSevereEvents.length) {
      var sr = [];
      a.doSevereEvents.forEach(function (e) { e.doSevere.forEach(function (f) { if (f.grade.sev === 2) sr.push(f.reading); }); });
      out.push({
        kind: 'critical',
        text: 'Dissolved oxygen below 4 mg/l (the CPCB Class C/D minimum, below the Class B bathing minimum of 5) in ' +
          a.doSevereEvents.length + ' of ' + a.sampledCount + ' sampled events' +
          (a.latestDurgaSevere ? ', including the most recent Durga event in the reports (' + a.latestDurga.year + ')' : '') + '.',
        refs: sr
      });
    } else {
      out.push({ kind: 'info', text: 'Dissolved oxygen was never recorded below 4 mg/l. This is why this ghat ranks below the HIGH-evidence ghats.', refs: [] });
    }
    var bodRefs = [];
    a.events.forEach(function (e) { (e.fails || []).forEach(function (f) { if (f.grade.code === 'bod_above_b') bodRefs.push(f.reading); }); });
    if (a.bod.above) {
      out.push({
        kind: 'persistent',
        text: 'BOD above the Class B limit of 3 mg/l in ' + a.bod.above + ' of ' + a.bod.measured + ' measured readings, including ' +
          a.bod.preAbove + ' of ' + a.bod.preMeasured + ' taken before immersion. The water already failed this limit before idols went in. Highest: ' +
          a.bod.max.value + ' mg/l (' + a.bod.max.festival + ' ' + a.bod.max.year + ', ' + PHASE[a.bod.max.phase].en + ').',
        refs: bodRefs
      });
    }
    var afterRefs = [];
    a.afterFailEvents.forEach(function (e) { e.fails.forEach(function (f) { if (f.reading.phase === 'after' && f.reading.parameter === 'Dissolved oxygen') afterRefs.push(f.reading); }); });
    if (afterRefs.length) {
      out.push({ kind: 'persistent', text: 'Dissolved oxygen was still below 5 mg/l one week after immersion in ' + afterRefs.length + ' event' + (afterRefs.length > 1 ? 's' : '') + '.', refs: afterRefs });
    }
    if (a.phFails.length) {
      out.push({ kind: 'info', text: 'pH outside the Class B range 6.5–8.5 in ' + a.phFails.length + ' reading' + (a.phFails.length > 1 ? 's' : '') + '.', refs: a.phFails });
    }
    return out;
  }

  function gapText(g, a) {
    if (g.code === 'G0') return 'No readings exist. A blank record is not a clean record.';
    if (g.code === 'G1') return 'No ' + g.festival + ' ' + g.year + ' table for this ghat in the ' + g.year + ' MPPCB report. Not sampled, or not reported: either way, no evidence.';
    if (g.code === 'G2') {
      var phases = [];
      g.missing.forEach(function (m) { if (phases.indexOf(m.phase) === -1) phases.push(m.phase); });
      return g.festival + ' ' + g.year + ': DO, BOD or pH not measured ' + list(phases.map(function (p) { return PHASE[p].en; }), 'en') + ' (report p.' + g.missing[0].page + ').';
    }
    if (g.code === 'G3') {
      return 'Site identity uncertain (match confidence: ' + g.siteMatch + '). Ganesh tables name "Kamla Park murti visarjan kund"; Durga tables name "Rani Kamlapati visarjan ghat (Lower Lake)". These may be two different places.';
    }
    return g.code;
  }

  // ---------- Suggested actions ----------

  function actions(a, lang) {
    var hi = lang === 'hi';
    var out = [];
    var gaps = a.gaps.map(function (g) { return g.code; });
    if (a.lane === 'act' || a.lane === 'act_verify') {
      out.push(hi
        ? 'विसर्जन से पहले सफ़ाई और वातन (एरेशन) की व्यवस्था की समीक्षा करें।'
        : 'Review cleaning and aeration arrangements before visarjan.');
      out.push(hi
        ? 'एमपीपीसीबी से विसर्जन के दौरान और एक सप्ताह बाद नमूना लेने का अनुरोध करें।'
        : 'Request MPPCB sampling during immersion and one week after.');
    }
    a.gaps.forEach(function (g) {
      if (g.code === 'G1') {
        out.push(hi
          ? VISARJAN_HI + ' से पहले विसर्जन-पूर्व नमूने का अनुरोध करें: ' + g.year + ' रिपोर्ट में इस घाट की ' + FEST_HI[g.festival] + ' तालिका नहीं है।'
          : 'Request a pre-immersion sample before ' + VISARJAN + ': the ' + g.year + ' report has no ' + g.festival + ' table for this ghat.');
      }
      if (g.code === 'G3') {
        out.push(hi
          ? 'पुष्टि करें कि दुर्गा "लोअर लेक घाट" के नमूने किस स्थान से लिए गए थे (गणेश तालिकाओं में "कमला पार्क कुंड" लिखा है)।'
          : 'Confirm which physical site the Durga "Lower Lake ghat" samples came from (Ganesh tables say "Kamla Park kund").');
      }
    });
    if (gaps.indexOf('G2') !== -1 && gaps.indexOf('G1') === -1) {
      out.push(hi ? 'विसर्जन से पहले और एक सप्ताह बाद, दोनों चरणों का नमूना सुनिश्चित करें।' : 'Make sure both the before and one-week-after phases are sampled.');
    }
    if (a.lane === 'verify') {
      out.push(hi ? 'कार्रवाई तय करने से पहले नया नमूना लेने का अनुरोध करें।' : 'Request a fresh sample before deciding on action.');
    }
    if (a.lane === 'watch' || a.lane === 'routine') {
      out.push(hi
        ? 'अधिकांश रीडिंग में बीओडी स्नान-सीमा से अधिक रहा: विसर्जन से पहले और बाद की नियमित एमपीपीसीबी जाँच में शामिल रखें।'
        : 'BOD exceeded the bathing limit in most readings: keep in routine MPPCB sampling before and after immersion.');
    }
    if (a.lane === 'baseline') {
      out.push(hi
        ? 'पहले उपयोग से पहले आधार (बेसलाइन) नमूने का अनुरोध करें; कोई रीडिंग उपलब्ध नहीं है।'
        : 'Request a baseline sample before first use; no readings exist.');
    }
    return out;
  }

  // ---------- Limitations (both languages, same meaning, same order) ----------

  function limitations(stats, lang) {
    if (lang === 'hi') {
      return [
        'ये 2023–2025 की एमपीपीसीबी रिपोर्टों के ऐतिहासिक आँकड़े हैं। यह लाइव निगरानी नहीं है; अक्टूबर 2026 की स्थिति ज्ञात नहीं है।',
        'कोलीफॉर्म (जीवाणु) की जाँच नहीं हुई, इसलिए जीवाणुओं के आधार पर स्नान-योग्यता का आकलन संभव नहीं है।',
        'रीडिंग की तुलना सीपीसीबी श्रेणी B (संगठित बाहरी स्नान) से की गई है। केवल DO, BOD और pH की श्रेणी B सीमा है। धातुओं (केवल क्रोमियम, सीसा, जस्ता, तांबा जाँचे गए) की कोई श्रेणी B सीमा नहीं है।',
        'विसर्जन से पहले भी ' + stats.bodPreMeasured + ' में से ' + stats.bodPreAboveB + ' बीओडी रीडिंग सीमा से अधिक थीं, इसलिए ये आँकड़े यह नहीं दिखाते कि प्रदूषण केवल विसर्जन से होता है।',
        'रिपोर्टों में इकाइयाँ छपी नहीं हैं; प्रत्येक जाँच की मानक इकाई मानी गई है।',
        '2026 में इन घाटों के उपयोग या अनुमति की पुष्टि नहीं की गई है। एनजीटी ने अपर और लोअर लेक में विसर्जन पर रोक लगाई है।',
        'यह निर्णय-सहायता है, एमपीपीसीबी या बीएमसी का आधिकारिक वर्गीकरण नहीं।'
      ];
    }
    return [
      'These are historical readings from the 2023–2025 MPPCB reports. This is not live monitoring; conditions in October 2026 are unknown.',
      'Coliform (bacteria) was not tested, so bathing suitability with respect to bacteria cannot be assessed.',
      'Readings are compared with CPCB Class B (organised outdoor bathing). Only DO, BOD and pH have Class B limits. Metals (only chromium, lead, zinc and copper were tested) have no Class B limit.',
      stats.bodPreAboveB + ' of ' + stats.bodPreMeasured + ' BOD readings were already above the limit before immersion, so the data does not show that immersion alone causes the pollution.',
      'The reports print no units; the standard unit for each test is assumed.',
      'Whether these ghats are used or authorised in 2026 has not been verified. The NGT has banned immersion in the Upper and Lower Lakes.',
      'This is decision support, not an official MPPCB or BMC classification.'
    ];
  }

  // ---------- The plan ----------

  function buildPlan(assessments, stats, lang) {
    var hi = lang === 'hi';
    var ranked = assessments.filter(function (a) { return a.rank !== null; });
    var unranked = assessments.filter(function (a) { return a.rank === null; });
    var rows = ranked.concat(unranked).map(function (a) {
      var pages = [];
      a.doSevereEvents.forEach(function (e) { var p = pageRef(e, lang); if (pages.indexOf(p) === -1) pages.push(p); });
      // No DO evidence: cite the page of the highest BOD reading instead.
      if (!pages.length && a.bod.max) pages.push(pageRef(a.bod.max, lang));
      return {
        id: a.ghat.id,
        rank: a.rank === null ? '–' : (a.joint ? '=' : '') + a.rank,
        name: nameIn(a, lang),
        lane: LANES[a.lane][lang],
        laneKey: a.lane,
        reason: shortReason(a, lang),
        actions: actions(a, lang),
        pages: pages,
        identityWarning: a.gaps.some(function (g) { return g.code === 'G3'; })
      };
    });
    var focus = ranked.filter(function (a) { return a.lane === 'act' || a.lane === 'act_verify'; });
    var sampling = [];
    focus.forEach(function (a) {
      var needsPre = a.gaps.some(function (g) { return g.code === 'G1' || g.code === 'G2'; });
      sampling.push(hi
        ? nameIn(a, lang) + ': ' + (needsPre ? 'विसर्जन-पूर्व नमूना (' + VISARJAN_HI + ' से पहले), ' : '') + 'विसर्जन के दौरान, और एक सप्ताह बाद (लगभग 27 अक्टूबर)।'
        : nameIn(a, lang) + ': ' + (needsPre ? 'pre-immersion sample (before ' + VISARJAN + '), ' : '') + 'during immersion, and one week after (around 27 October).');
    });
    sampling.push(hi
      ? 'सभी नमूनों में कुल कोलीफॉर्म शामिल करने का अनुरोध करें: यह श्रेणी B का एकमात्र मानदंड है जिसकी 2023–2025 में कभी जाँच नहीं हुई।'
      : 'Ask for total coliform to be included in all samples: it is the only Class B criterion never tested in 2023–2025.');

    return {
      lang: lang,
      title: hi ? 'विसर्जन-पूर्व कार्य योजना: भोपाल के विसर्जन घाट' : 'Pre-Visarjan Action Plan: Bhopal immersion ghats',
      subtitle: hi
        ? 'दुर्गा विसर्जन ' + VISARJAN_HI + '। आधार: एमपीपीसीबी जल-गुणवत्ता रिपोर्ट 2023–2025 (ऐतिहासिक आँकड़े)।'
        : 'Durga visarjan ' + VISARJAN + '. Based on MPPCB water-quality reports 2023–2025 (historical data).',
      headline: hi
        ? 'मुख्य निष्कर्ष: ' + stats.doMeasured + ' में से ' + stats.doBelowB + ' DO रीडिंग 5 mg/l से कम; ' + stats.bodMeasured + ' में से ' + stats.bodAboveB + ' बीओडी रीडिंग 3 mg/l से अधिक; बैरागढ़ कुंड में DO ' + stats.doZero.length + ' बार शून्य दर्ज।'
        : 'Key findings: ' + stats.doBelowB + ' of ' + stats.doMeasured + ' DO readings below 5 mg/l; ' + stats.bodAboveB + ' of ' + stats.bodMeasured + ' BOD readings above 3 mg/l; DO recorded as zero ' + stats.doZero.length + ' times at Bairagarh kund.',
      method: hi
        ? 'प्राथमिकता केवल मापे गए आँकड़ों से तय होती है (मुख्यतः DO 4 mg/l से कम)। अधूरे आँकड़े प्राथमिकता नहीं बदलते, केवल सुझाई गई कार्रवाई में जाँच जोड़ते हैं। "=" का अर्थ बराबर प्राथमिकता।'
        : 'Priority comes from measured readings only (mainly DO below 4 mg/l). Missing data does not change priority; it adds verification to the suggested action. "=" means joint priority.',
      columns: hi
        ? ['क्रम', 'घाट', 'श्रेणी', 'कारण', 'सुझाई गई कार्रवाई', 'स्रोत']
        : ['Rank', 'Ghat', 'Lane', 'Why', 'Suggested action', 'Source'],
      rows: rows,
      samplingTitle: hi ? 'सुझाए गए नमूना अनुरोध (एमपीपीसीबी को)' : 'Suggested sampling requests (to MPPCB)',
      sampling: sampling,
      limitsTitle: hi ? 'ये आँकड़े क्या नहीं बताते' : 'What this data does not establish',
      limits: limitations(stats, lang),
      footer: hi
        ? 'निर्णय-सहायता उपकरण: विसर्जन घाट वॉच (टीम द मेंटलिस्ट)। सभी कार्रवाइयाँ सुझाव हैं, अधिकारी के विवेक और 2026 में घाट की स्थिति के अधीन।'
        : 'Decision-support tool: Visarjan Ghat Watch (Team THE MENTALIST). All actions are suggestions, subject to officer judgment and each ghat\'s 2026 status.'
    };
  }

  // Short version for WhatsApp / email: top-priority ghats, actions, key caveats.
  function planToText(plan) {
    var hi = plan.lang === 'hi';
    var lines = [plan.title, plan.subtitle, ''];
    plan.rows.forEach(function (r) {
      if (r.laneKey === 'watch' || r.laneKey === 'routine') return;
      lines.push((r.rank === '–' ? '•' : r.rank + '.') + ' ' + r.name + ' [' + r.lane + ']');
      lines.push('   ' + r.reason);
      r.actions.forEach(function (x) { lines.push('   - ' + x); });
      if (r.pages.length) lines.push('   ' + (hi ? 'स्रोत: ' : 'Source: ') + r.pages.join('; '));
    });
    var watch = plan.rows.filter(function (r) { return r.laneKey === 'watch' || r.laneKey === 'routine'; });
    if (watch.length) {
      lines.push('');
      lines.push((hi ? 'निगरानी रखें (बीओडी अधिकांश रीडिंग में सीमा से अधिक): ' : 'Watch (BOD above limit in most readings): ') + watch.map(function (r) { return r.name; }).join(', '));
    }
    lines.push('');
    lines.push(plan.samplingTitle + ':');
    plan.sampling.forEach(function (s) { lines.push('- ' + s); });
    lines.push('');
    lines.push(plan.limitsTitle + ':');
    [0, 1, 5, 6].forEach(function (i) { lines.push('- ' + plan.limits[i]); });
    return lines.join('\n');
  }

  // Detects unsupported claims while allowing legitimate negations such as
  // "not live monitoring". Returns the list of offending phrases.
  function unsupportedClaims(text) {
    var allowed = [
      /not live monitoring/gi, /लाइव निगरानी नहीं/g
    ];
    var t = text;
    allowed.forEach(function (re) { t = t.replace(re, ''); });
    var forbidden = [
      /\bsafe\b/i, /\bunsafe\b/i, /\bsafety\b/i, /\blive\b/i, /\breal[- ]?time\b/i,
      /\btoxic\b/i, /\bdisease\w*\b/i, /\bcancer\w*\b/i, /\bhealth (risk|hazard|effect)s?\b/i,
      /\bpredict\w*\b/i, /\bforecast\w*\b/i, /\bguarantee\w*\b/i, /\bofficial (risk )?(classification|rating)\b/i,
      /सुरक्षित/, /असुरक्षित/, /बीमारी/, /रोग/, /कैंसर/, /ज़हरीला|जहरीला|विषैला/, /लाइव/, /रियल[- ]?टाइम/, /भविष्यवाणी|पूर्वानुमान/
    ];
    var found = [];
    forbidden.forEach(function (re) { var m = t.match(re); if (m) found.push(m[0]); });
    return found;
  }

  return {
    LANES: LANES,
    LANE_ORDER: LANE_ORDER,
    NAMES_HI: NAMES_HI,
    PHASE: PHASE,
    shortReason: shortReason,
    reasons: reasons,
    gapText: gapText,
    actions: actions,
    limitations: limitations,
    buildPlan: buildPlan,
    planToText: planToText,
    unsupportedClaims: unsupportedClaims
  };
}));
