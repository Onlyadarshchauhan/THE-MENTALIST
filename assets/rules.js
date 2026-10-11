/*
 * Visarjan Ghat Watch: data handling and ranking rules.
 *
 * Pure functions only. The same file runs in the browser (window.VGWRules)
 * and in Node for the build script and tests (module.exports).
 *
 * Two things are kept apart on purpose:
 *   evidence   = what the measured readings show against CPCB limits
 *   confidence = how complete and certain the record is
 * Priority order uses evidence only. Confidence changes the suggested action,
 * never the order, so missing data can neither hide a ghat nor push it up.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VGWRules = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PHASES = ['pre', 'during', 'after'];
  var FESTIVALS = ['Durga', 'Ganesh']; // Durga first: it is the officer's decision
  var CLASS_B_PARAMS = ['Dissolved oxygen', 'BOD', 'pH'];
  var NOT_SAMPLED_FLAGS = ['not sampled', '*', '**'];

  // PDF that each year's source_page refers to. Page counts checked against the files.
  var REPORTS = {
    '2023': { file: 'Idol_immer._Report_23_CPCB.pdf', title: 'MPPCB Idol Immersion Report 2023 (CPCB format)', pages: 87 },
    '2024': { file: 'Ganesh_and_Durga_visarjan_report-2024.pdf', title: 'MPPCB Ganesh and Durga Visarjan Report 2024', pages: 118 },
    '2025': { file: 'Ganesh_and_Durga_visarjan_report-2025.pdf', title: 'MPPCB Ganesh and Durga Visarjan Report 2025', pages: 92 }
  };

  // ---------- CSV ----------

  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    var rows = [], row = [], field = '', quoted = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
        } else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    rows = rows.filter(function (r) { return !(r.length === 1 && r[0] === ''); });
    var header = rows.shift();
    return rows.map(function (r, n) {
      if (r.length !== header.length) throw new Error('CSV row ' + (n + 2) + ' has ' + r.length + ' fields, expected ' + header.length);
      var o = {};
      header.forEach(function (h, j) { o[h] = r[j]; });
      return o;
    });
  }

  // ---------- Thresholds from the CPCB criteria file ----------

  function thresholdsFromCriteria(criteria) {
    function find(cls, param) {
      var r = criteria.filter(function (c) { return c['class'] === cls && c.parameter === param; })[0];
      if (!r) throw new Error('CPCB criteria missing class ' + cls + ' ' + param);
      return r;
    }
    var ph = find('B', 'pH').limit.split('-').map(Number);
    var doC = Number(find('C', 'Dissolved oxygen').limit);
    var doD = Number(find('D', 'Dissolved oxygen').limit);
    return {
      classB: {
        'pH': { min: ph[0], max: ph[1], unit: '' },
        'Dissolved oxygen': { min: Number(find('B', 'Dissolved oxygen').limit), unit: 'mg/l' },
        'BOD': { max: Number(find('B', 'BOD (5 days 20C)').limit), unit: 'mg/l' }
      },
      // Severity step only: the DO minimum for Class C (drinking source after treatment)
      // and Class D (wildlife and fisheries). Both are 4 in the criteria file.
      doSevere: Math.min(doC, doD),
      conductivityClassE: Number(find('E', 'Electrical conductivity at 25C').limit)
    };
  }

  // ---------- Readings ----------

  function normaliseReading(raw, index) {
    var where = 'row ' + (index + 2) + ' (' + raw.site + ' ' + raw.year + ' ' + raw.festival + ' ' + raw.phase + ' ' + raw.parameter + ')';
    var v = (raw.value || '').trim();
    var flag = (raw.flag || '').trim();
    var printed = (raw.value_as_printed || '').trim();
    var status, value = null;
    if (v !== '') {
      if (flag) throw new Error(where + ': has both a value and flag "' + flag + '"');
      value = Number(v);
      if (!isFinite(value)) throw new Error(where + ': value "' + v + '" is not a number');
      status = 'measured';
    } else if (flag === 'BDL' || printed.toUpperCase() === 'BDL') status = 'bdl';
    else if (flag === 'ND' || printed.toUpperCase() === 'ND') status = 'nd';
    else if (NOT_SAMPLED_FLAGS.indexOf(flag) !== -1) status = 'not_sampled';
    else throw new Error(where + ': unknown flag "' + flag + '" (printed "' + printed + '")');

    if ((status === 'bdl' || status === 'nd') && CLASS_B_PARAMS.indexOf(raw.parameter) !== -1) {
      // Does not occur in the 2023-25 data. If it ever does, a person must decide what it means.
      throw new Error(where + ': ' + status.toUpperCase() + ' on a Class B parameter needs manual review');
    }
    if (PHASES.indexOf(raw.phase) === -1) throw new Error(where + ': unknown phase "' + raw.phase + '"');
    if (FESTIVALS.indexOf(raw.festival) === -1) throw new Error(where + ': unknown festival "' + raw.festival + '"');
    var page = Number(raw.source_page);
    var report = REPORTS[raw.year];
    if (!report) throw new Error(where + ': no report known for year ' + raw.year);
    if (!(page >= 1 && page <= report.pages && Math.floor(page) === page)) {
      throw new Error(where + ': source_page "' + raw.source_page + '" is outside the ' + report.pages + '-page report');
    }
    return {
      id: index,
      site: raw.site,
      waterBody: raw.water_body,
      year: raw.year,
      festival: raw.festival,
      phase: raw.phase,
      parameter: raw.parameter,
      unit: raw.unit_assumed,
      status: status,
      value: value,
      printed: printed,
      flag: flag,
      parameterPrinted: raw.parameter_as_printed,
      sitePrinted: raw.site_as_printed,
      siteMatch: raw.site_match_confidence,
      page: page
    };
  }

  function sourceLink(year, page) {
    var r = REPORTS[year];
    return 'reports/' + r.file + '#page=' + page;
  }

  // ---------- Grading one reading against Class B ----------

  // Returns null when there is no measured value, 'nolimit' when CPCB Class B
  // sets no limit for the parameter, 'pass', or a failure object.
  function grade(r, th) {
    if (r.status !== 'measured') return null;
    var lim = th.classB[r.parameter];
    if (!lim) return 'nolimit';
    var v = r.value;
    if (r.parameter === 'Dissolved oxygen') {
      if (v === 0) return { sev: 3, code: 'do_zero' };
      if (v < th.doSevere) return { sev: 2, code: 'do_below_severe' };
      if (v < lim.min) return { sev: 1, code: 'do_below_b' };
      return 'pass';
    }
    if (r.parameter === 'BOD') {
      if (v > lim.max) return { sev: 1, code: 'bod_above_b', ratio: v / lim.max };
      return 'pass';
    }
    if (r.parameter === 'pH') {
      if (v < lim.min || v > lim.max) return { sev: 1, code: 'ph_outside_b' };
      return 'pass';
    }
    return 'nolimit';
  }

  function isFail(g) { return g !== null && typeof g === 'object'; }
  function hasData(r) { return r.status === 'measured' || r.status === 'bdl' || r.status === 'nd'; }

  // ---------- Dataset ----------

  function buildDataset(rawRows, criteria) {
    var readings = rawRows.map(normaliseReading);
    var th = thresholdsFromCriteria(criteria);
    var years = unique(readings.map(function (r) { return r.year; })).sort();
    var sites = unique(readings.map(function (r) { return r.site; }));
    var ghats = sites.map(function (s) {
      var rs = readings.filter(function (r) { return r.site === s; });
      return {
        id: slug(s),
        name: s,
        waterBody: rs[0].waterBody,
        siteMatch: rs[0].siteMatch,
        printedNames: printedNames(rs)
      };
    });
    return { readings: readings, thresholds: th, years: years, ghats: ghats };
  }

  function printedNames(rs) {
    var out = {};
    rs.forEach(function (r) {
      var k = r.festival + ' ' + r.year;
      out[k] = out[k] || [];
      if (out[k].indexOf(r.sitePrinted) === -1) out[k].push(r.sitePrinted);
    });
    return out;
  }

  // Every ghat is expected in every year x festival table. Where the report has
  // no table at all, an explicit missing event is created so it cannot vanish.
  function eventsFor(ghatName, readings, years) {
    var events = [];
    years.slice().sort().reverse().forEach(function (y) {
      FESTIVALS.forEach(function (f) {
        var rs = readings.filter(function (r) { return r.site === ghatName && r.year === y && r.festival === f; });
        var status = rs.length === 0 ? 'missing' : (rs.some(hasData) ? 'sampled' : 'not_sampled');
        events.push({
          key: y + ' ' + f,
          year: y,
          festival: f,
          status: status,
          page: rs.length ? rs[0].page : null,
          readings: rs
        });
      });
    });
    return events;
  }

  function missingEvents(ds) {
    var out = [];
    ds.ghats.forEach(function (g) {
      eventsFor(g.name, ds.readings, ds.years).forEach(function (e) {
        if (e.status === 'missing') out.push({ site: g.name, year: e.year, festival: e.festival });
      });
    });
    return out;
  }

  // ---------- Assessing one ghat ----------

  var EVIDENCE_ORDER = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };

  function assessGhat(ghat, readings, years, th) {
    var latestYear = years.slice().sort()[years.length - 1];
    var events = eventsFor(ghat.name, readings, years);
    var sampled = events.filter(function (e) { return e.status === 'sampled'; });

    events.forEach(function (e) {
      e.fails = [];
      e.readings.forEach(function (r) {
        var g = grade(r, th);
        if (isFail(g)) e.fails.push({ reading: r, grade: g });
      });
      e.maxSev = e.fails.reduce(function (m, f) { return Math.max(m, f.grade.sev); }, 0);
      e.doSevere = e.fails.filter(function (f) { return f.grade.sev >= 2; });
      e.doZero = e.fails.filter(function (f) { return f.grade.sev === 3; });
    });

    var doSevereEvents = sampled.filter(function (e) { return e.doSevere.length > 0; });
    var doZeroEvents = sampled.filter(function (e) { return e.doZero.length > 0; });
    var classBFailEvents = sampled.filter(function (e) { return e.fails.length > 0; });
    var durga = sampled.filter(function (e) { return e.festival === 'Durga'; })
      .sort(function (a, b) { return a.year < b.year ? 1 : -1; });
    var latestDurga = durga[0] || null;

    var evidence;
    if (sampled.length === 0) evidence = 'NONE';
    else if (doSevereEvents.length >= 2 || (latestDurga && latestDurga.doSevere.length > 0)) evidence = 'HIGH';
    else if (classBFailEvents.length * 2 >= sampled.length && classBFailEvents.length > 0) evidence = 'MEDIUM';
    else evidence = 'LOW';

    // Confidence: gaps in the most recent record or in site identity.
    var gaps = [];
    events.filter(function (e) { return e.year === latestYear && e.status !== 'sampled'; }).forEach(function (e) {
      gaps.push({ code: 'G1', year: e.year, festival: e.festival, eventStatus: e.status });
    });
    events.filter(function (e) { return e.year === latestYear && e.status === 'sampled'; }).forEach(function (e) {
      var missing = [];
      CLASS_B_PARAMS.forEach(function (p) {
        PHASES.forEach(function (ph) {
          var r = e.readings.filter(function (x) { return x.parameter === p && x.phase === ph; })[0];
          if (!r || r.status !== 'measured') missing.push({ parameter: p, phase: ph, printed: r ? r.printed : '', page: e.page });
        });
      });
      if (missing.length) gaps.push({ code: 'G2', year: e.year, festival: e.festival, missing: missing });
    });
    if (ghat.siteMatch && ghat.siteMatch !== 'high') gaps.push({ code: 'G3', siteMatch: ghat.siteMatch });
    if (evidence === 'NONE') gaps = [{ code: 'G0' }]; // no readings at all: one plain gap, not a list
    var confidence = gaps.length ? 'GAPS' : 'ADEQUATE';

    // Older Class B gaps: listed for the officer, do not change confidence.
    var olderGaps = [];
    events.filter(function (e) { return e.year !== latestYear && e.status === 'sampled'; }).forEach(function (e) {
      e.readings.forEach(function (r) {
        if (CLASS_B_PARAMS.indexOf(r.parameter) !== -1 && r.status !== 'measured') olderGaps.push(r);
      });
    });

    var lane;
    if (evidence === 'NONE') lane = 'baseline';
    else if (evidence === 'HIGH') lane = confidence === 'GAPS' ? 'act_verify' : 'act';
    else if (confidence === 'GAPS') lane = 'verify';
    else lane = evidence === 'MEDIUM' ? 'watch' : 'routine';

    // Persistent BOD and the before/after pattern, shown even where DO drives the rank.
    var measured = function (p, phase) {
      return readings.filter(function (r) {
        return r.site === ghat.name && r.parameter === p && r.status === 'measured' && (!phase || r.phase === phase);
      });
    };
    var bodAll = measured('BOD'), bodPre = measured('BOD', 'pre');
    var doAll = measured('Dissolved oxygen');
    var phFails = measured('pH').filter(function (r) { return isFail(grade(r, th)); });
    var afterFailEvents = sampled.filter(function (e) {
      return e.fails.some(function (f) { return f.reading.phase === 'after'; });
    });
    var minDo = doAll.reduce(function (m, r) { return m === null || r.value < m.value ? r : m; }, null);

    return {
      ghat: ghat,
      events: events,
      sampledCount: sampled.length,
      eventCount: events.length,
      evidence: evidence,
      confidence: confidence,
      gaps: gaps,
      olderGaps: olderGaps,
      lane: lane,
      doSevereEvents: doSevereEvents,
      doZeroEvents: doZeroEvents,
      classBFailEvents: classBFailEvents,
      afterFailEvents: afterFailEvents,
      latestDurga: latestDurga,
      latestDurgaSevere: !!(latestDurga && latestDurga.doSevere.length),
      minDo: minDo,
      bod: {
        measured: bodAll.length,
        above: bodAll.filter(function (r) { return isFail(grade(r, th)); }).length,
        preMeasured: bodPre.length,
        preAbove: bodPre.filter(function (r) { return isFail(grade(r, th)); }).length,
        max: bodAll.reduce(function (m, r) { return m === null || r.value > m.value ? r : m; }, null)
      },
      phFails: phFails,
      rankKey: [EVIDENCE_ORDER[evidence], doSevereEvents.length, doZeroEvents.length]
    };
  }

  // Standard competition ranking (1, 2, 3, 3, 5). Equal keys share a rank.
  // NONE ghats (no readings) are not ranked; they sit in "establish baseline".
  function rankAll(assessments) {
    var ranked = assessments.filter(function (a) { return a.evidence !== 'NONE'; });
    ranked.sort(function (a, b) {
      for (var i = 0; i < a.rankKey.length; i++) if (a.rankKey[i] !== b.rankKey[i]) return b.rankKey[i] - a.rankKey[i];
      return a.ghat.name < b.ghat.name ? -1 : 1;
    });
    ranked.forEach(function (a, i) {
      var prev = ranked[i - 1];
      a.rank = prev && sameKey(prev.rankKey, a.rankKey) ? prev.rank : i + 1;
    });
    ranked.forEach(function (a) {
      a.joint = ranked.filter(function (b) { return b.rank === a.rank; }).length > 1;
    });
    var unranked = assessments.filter(function (a) { return a.evidence === 'NONE'; });
    unranked.forEach(function (a) { a.rank = null; a.joint = false; });
    return ranked.concat(unranked);
  }

  function assessAll(ds, extraGhats) {
    var list = ds.ghats.concat(extraGhats || []).map(function (g) {
      return assessGhat(g, ds.readings, ds.years, ds.thresholds);
    });
    return rankAll(list);
  }

  // ---------- Headline statistics ----------

  function headlineStats(ds) {
    var th = ds.thresholds;
    function num(p, phase) {
      return ds.readings.filter(function (r) {
        return r.parameter === p && r.status === 'measured' && (!phase || r.phase === phase);
      });
    }
    var dos = num('Dissolved oxygen'), bods = num('BOD'), bodPre = num('BOD', 'pre'), ph = num('pH');
    return {
      doMeasured: dos.length,
      doBelowB: dos.filter(function (r) { return r.value < th.classB['Dissolved oxygen'].min; }).length,
      doBelowSevere: dos.filter(function (r) { return r.value < th.doSevere; }).length,
      doZero: dos.filter(function (r) { return r.value === 0; }),
      bodMeasured: bods.length,
      bodAboveB: bods.filter(function (r) { return r.value > th.classB.BOD.max; }).length,
      bodPreMeasured: bodPre.length,
      bodPreAboveB: bodPre.filter(function (r) { return r.value > th.classB.BOD.max; }).length,
      phMeasured: ph.length,
      phOutside: ph.filter(function (r) { return r.value < th.classB.pH.min || r.value > th.classB.pH.max; }).length,
      rows: ds.readings.length,
      statusCounts: countBy(ds.readings, function (r) { return r.status; })
    };
  }

  // ---------- helpers ----------

  function unique(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function sameKey(a, b) { return a.every(function (x, i) { return x === b[i]; }); }
  function countBy(a, f) { var o = {}; a.forEach(function (x) { var k = f(x); o[k] = (o[k] || 0) + 1; }); return o; }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  return {
    PHASES: PHASES,
    FESTIVALS: FESTIVALS,
    CLASS_B_PARAMS: CLASS_B_PARAMS,
    REPORTS: REPORTS,
    parseCsv: parseCsv,
    thresholdsFromCriteria: thresholdsFromCriteria,
    normaliseReading: normaliseReading,
    buildDataset: buildDataset,
    eventsFor: eventsFor,
    missingEvents: missingEvents,
    grade: grade,
    isFail: isFail,
    assessGhat: assessGhat,
    rankAll: rankAll,
    assessAll: assessAll,
    headlineStats: headlineStats,
    sourceLink: sourceLink,
    slug: slug
  };
}));
