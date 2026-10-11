/* Visarjan Ghat Watch: screens. All logic lives in rules.js and brief.js. */
(function () {
  'use strict';
  var R = window.VGWRules, B = window.VGWBrief, D = window.VGW_DATA;
  var app = document.getElementById('app');

  if (!D || !R || !B) {
    app.innerHTML = '<div class="wrap"><p>Data failed to load. Run <code>node scripts/build-data.js</code> and reload.</p></div>';
    return;
  }

  var ds = { readings: D.readings, thresholds: D.thresholds, years: D.years, ghats: D.ghats };
  var assessed = R.assessAll(ds, D.config.newGhats);
  var stats = R.headlineStats(ds);
  var byId = {};
  assessed.forEach(function (a) { byId[a.ghat.id] = a; });
  var TH = D.thresholds;
  var PHASE_SHORT = { pre: 'Before', during: 'During', after: '+1 week' };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pdf(year, page, label) {
    return '<a class="ref" target="_blank" rel="noopener" href="' + esc(R.sourceLink(year, page)) + '" title="Open ' +
      esc(R.REPORTS[year].title) + ', PDF page ' + page + '">' + label + ' ↗</a>';
  }
  function refChip(r) {
    var v = r.status === 'measured' ? r.value : r.printed || r.status;
    var unit = r.unit ? ' ' + r.unit : '';
    var label = '<b>' + esc(v) + esc(unit) + '</b> ' + esc(short(r.parameter)) + ' · ' + esc(r.festival + ' ' + r.year) + ' · ' +
      esc(PHASE_SHORT[r.phase].toLowerCase()) + ' · p.' + r.page;
    return pdf(r.year, r.page, label);
  }
  function short(p) { return p === 'Dissolved oxygen' ? 'DO' : p; }
  function laneChip(lane) { return '<span class="lane lane-' + lane + '">' + esc(B.LANES[lane].en) + '</span>'; }
  function evChip(a) {
    var t = { HIGH: 'Evidence: high', MEDIUM: 'Evidence: medium', LOW: 'Evidence: low', NONE: 'No readings' }[a.evidence];
    return '<span class="chip ev-' + a.evidence + '">' + t + '</span>';
  }
  function confChip(a) {
    return a.confidence === 'GAPS'
      ? '<span class="chip gap">Coverage: gaps</span>'
      : '<span class="chip ok">Coverage: adequate</span>';
  }
  function extraChips(a) {
    var out = '';
    if (a.gaps.some(function (g) { return g.code === 'G3'; })) out += '<span class="chip gap">⚠ Site identity uncertain</span>';
    if (a.gaps.some(function (g) { return g.code === 'G1'; }) && a.evidence !== 'NONE') out += '<span class="chip gap">No Durga 2025 table</span>';
    out += '<span class="chip neutral">2026 use: not verified</span>';
    return out;
  }
  function rankLabel(a) { return a.rank === null ? '–' : (a.joint ? '=' : '') + a.rank; }

  // ---------- countdown ----------
  (function () {
    var el = document.getElementById('countdown');
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((new Date(2026, 9, 20) - today) / 86400000);
    el.textContent = days > 0 ? 'Durga visarjan: 20 Oct 2026 · ' + days + ' day' + (days === 1 ? '' : 's') + ' to go'
      : days === 0 ? 'Durga visarjan is today (20 Oct 2026)' : 'Durga visarjan 2026 was on 20 Oct';
  }());

  // ---------- modal ----------
  var modal = document.getElementById('modal');
  function openModal(html) {
    document.getElementById('modal-body').innerHTML = html;
    modal.hidden = false;
    modal.querySelector('.modal-close').focus();
  }
  function closeModal() { modal.hidden = true; }
  modal.addEventListener('click', function (e) { if (e.target === modal || e.target.classList.contains('modal-close')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  function readingTable(title, intro, rows) {
    return '<h2 id="modal-title">' + esc(title) + '</h2><p class="muted">' + intro + '</p>' +
      '<table class="src"><tr><th>Ghat</th><th>Event</th><th>Phase</th><th>Reading</th><th>Source</th></tr>' +
      rows.map(function (r) {
        var g = R.grade(r, TH);
        return '<tr><td>' + esc(r.site) + '</td><td>' + esc(r.festival + ' ' + r.year) + '</td><td>' + esc(B.PHASE[r.phase].en) +
          '</td><td' + (R.isFail(g) ? ' style="color:var(--critical);font-weight:700"' : '') + '>' + esc(r.value) + ' ' + esc(r.unit) +
          '</td><td>' + pdf(r.year, r.page, 'p.' + r.page) + '</td></tr>';
      }).join('') + '</table>';
  }

  var INSIGHTS = {
    prebod: function () {
      var rows = ds.readings.filter(function (r) { return r.parameter === 'BOD' && r.phase === 'pre' && r.status === 'measured'; });
      openModal(readingTable('BOD before immersion: ' + stats.bodPreAboveB + ' of ' + stats.bodPreMeasured + ' above 3 mg/l',
        'Every measured pre-immersion BOD reading. The CPCB Class B (bathing) limit is 3 mg/l or less. Most ghats already failed it before idols went in, so cleaning and aeration matter before the day, and immersion alone is not shown to be the cause.', rows));
    },
    do: function () {
      var rows = ds.readings.filter(function (r) { return r.parameter === 'Dissolved oxygen' && r.status === 'measured' && r.value < TH.classB['Dissolved oxygen'].min; })
        .sort(function (a, b) { return a.value - b.value; });
      openModal(readingTable('Dissolved oxygen below 5 mg/l: ' + stats.doBelowB + ' of ' + stats.doMeasured + ' readings',
        'Lowest first. Class B (bathing) needs 5 mg/l or more; Classes C and D need 4 or more. ' + stats.doBelowSevere + ' readings are below 4.', rows));
    },
    zero: function () {
      openModal(readingTable('Zero dissolved oxygen: ' + stats.doZero.length + ' readings',
        'All at Bairagarh (Sant Hirdaram) kund. Open each page to see the value printed in the MPPCB report.', stats.doZero));
    }
  };

  // ---------- board ----------
  function gcard(a) {
    var why = B.shortReason(a, 'en');
    return '<a class="gcard" href="#/ghat/' + a.ghat.id + '">' +
      '<div class="t"><span class="rank">' + rankLabel(a) + '</span><span class="nm">' + esc(a.ghat.name) + '</span></div>' +
      '<div class="why">' + esc(why) + '</div>' +
      '<div class="chips">' + extraChips(a) + '</div></a>';
  }

  function renderBoard() {
    var ranked = assessed.filter(function (a) { return a.rank !== null; });
    var cell = function (lane) {
      return ranked.filter(function (a) { return a.lane === lane; }).map(gcard).join('');
    };
    var empty = '<p class="empty">No ghats here.</p>';
    var baseline = assessed.filter(function (a) { return a.lane === 'baseline'; });

    app.innerHTML = '<div class="wrap">' +
      '<div class="board-head"><div><h1>Where should BMC act first before Durga visarjan?</h1>' +
      '<p>Seven ghats ranked from ' + stats.rows.toLocaleString('en-IN') + ' MPPCB readings (2023–2025) against CPCB Class B bathing limits. ' +
      '<b>Priority</b> comes from what was measured. <b>Coverage</b> shows where the record is incomplete and new sampling should be requested. Missing data never counts as clean.</p></div>' +
      '<a class="cta" href="#/plan">Generate action plan · कार्य योजना →</a></div>' +

      '<div class="insights">' +
      '<button class="insight" data-insight="prebod"><b>' + stats.bodPreAboveB + ' of ' + stats.bodPreMeasured + '</b><span>BOD readings taken <u>before</u> immersion were already above the bathing limit (3 mg/l)</span><em>See every reading →</em></button>' +
      '<button class="insight" data-insight="do"><b>' + stats.doBelowB + ' of ' + stats.doMeasured + '</b><span>dissolved-oxygen readings below 5 mg/l; ' + stats.doBelowSevere + ' below 4 mg/l</span><em>See every reading →</em></button>' +
      '<button class="insight" data-insight="zero"><b>' + stats.doZero.length + '×</b><span>zero dissolved oxygen recorded at Bairagarh kund, which has no Durga 2025 table in the report</span><em>Open the source pages →</em></button>' +
      '</div>' +

      '<div class="board-grid"><section aria-label="Evidence and coverage matrix"><div class="matrix">' +
      '<div></div><div class="axis-x">Coverage adequate<small>Recent record complete</small></div><div class="axis-x">Coverage has gaps<small>Missing table, phase or uncertain site</small></div>' +
      '<div class="axis-y">Evidence high · DO &lt; 4</div>' +
      '<div class="cell hot"><div class="cell-head">' + laneChip('act') + '<small>Act on the evidence</small></div>' + (cell('act') || empty) + '</div>' +
      '<div class="cell hot gapcell"><div class="cell-head">' + laneChip('act_verify') + '<small>Act, and request new samples</small></div>' + (cell('act_verify') || empty) + '</div>' +
      '<div class="axis-y">Evidence medium / low</div>' +
      '<div class="cell"><div class="cell-head">' + laneChip('watch') + '<small>BOD failures, no severe oxygen loss</small></div>' + (cell('watch') + cell('routine') || empty) + '</div>' +
      '<div class="cell gapcell"><div class="cell-head">' + laneChip('verify') + '<small>Too little evidence: test first</small></div>' + (cell('verify') || empty) + '</div>' +
      '<div></div><div class="baseline-row cell gapcell" style="min-height:0"><div class="cell-head">' + laneChip('baseline') + '<small>No readings exist</small></div>' +
      baseline.map(function (a) {
        var ng = (D.config.newGhats || []).filter(function (n) { return n.id === a.ghat.id; })[0] || {};
        return '<a class="gcard" href="#/ghat/' + a.ghat.id + '"><div class="t"><span class="rank">–</span><span class="nm">' + esc(a.ghat.name) + '</span></div><div class="why">' +
          esc(ng.note || 'No readings in the 2023–2025 reports.') + '</div></a>';
      }).join('') + '</div>' +
      '</div></section>' +

      '<aside class="side"><h2>Priority order</h2><ol class="plist">' +
      ranked.map(function (a) {
        return '<li><span class="rank">' + rankLabel(a) + '</span><div><a href="#/ghat/' + a.ghat.id + '">' + esc(a.ghat.name) + '</a> ' + laneChip(a.lane) +
          '<div class="meter"><span>DO &lt; 4: <b>' + a.doSevereEvents.length + '/' + a.sampledCount + '</b> events</span>' +
          '<span>BOD &gt; 3: <b>' + a.bod.above + '/' + a.bod.measured + '</b> readings</span>' +
          (a.confidence === 'GAPS' ? '<span class="warn-inline">coverage gaps</span>' : '') + '</div></div></li>';
      }).join('') + '</ol>' +
      '<details class="how"><summary>How the ranking works</summary><ol>' +
      '<li><b>Evidence high</b>: dissolved oxygen below 4 mg/l (the CPCB Class C/D minimum) in 2 or more events, or in the most recent Durga record.</li>' +
      '<li><b>Evidence medium</b>: a Class B failure (DO &lt; 5, BOD &gt; 3, pH outside 6.5–8.5) in at least half of the sampled events.</li>' +
      '<li>Order: evidence level, then the number of events with DO &lt; 4, then events with DO = 0. Ties are shown as joint (=).</li>' +
      '<li><b>Coverage gaps</b> (no 2025 table, unsampled 2025 phases, uncertain site) change the suggested action, never the order.</li>' +
      '<li>BOD exceeds the limit at almost every ghat, so it cannot separate them. It is shown for every ghat but does not set the order.</li>' +
      '</ol><p><a href="#/method">Full method and limits →</a></p></details>' +
      '<p class="muted" style="font-size:.8rem;margin-top:10px">An algorithmic priority for planning, built by Team THE MENTALIST. It is not an official MPPCB or BMC risk classification.</p>' +
      '</aside></div></div>';

    app.querySelectorAll('[data-insight]').forEach(function (b) {
      b.addEventListener('click', function () { INSIGHTS[b.getAttribute('data-insight')](); });
    });
  }

  // ---------- strip chart for one event and parameter ----------
  function strip(e, param) {
    var isDo = param === 'Dissolved oxygen';
    var W = 150, H = 92, padL = 22, padR = 6, padT = 8, padB = 18;
    var rs = R.PHASES.map(function (ph) { return e.readings.filter(function (r) { return r.parameter === param && r.phase === ph; })[0]; });
    var vals = rs.map(function (r) { return r && r.status === 'measured' ? r.value : null; });
    var yMax = isDo ? 12 : Math.max(15, Math.ceil(Math.max.apply(null, vals.concat([0])) / 5) * 5);
    var x = function (i) { return padL + i * (W - padL - padR) / 2; };
    var y = function (v) { return padT + (1 - v / yMax) * (H - padT - padB); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(short(param) + ' ' + e.key) + '">';
    s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#c9d1d6"/>';
    var lines = isDo ? [[TH.classB['Dissolved oxygen'].min, '#a4161a', '5'], [TH.doSevere, '#7a0d10', '4']] : [[TH.classB.BOD.max, '#a4161a', '3']];
    lines.forEach(function (l) {
      s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(l[0]) + '" y2="' + y(l[0]) + '" stroke="' + l[1] + '" stroke-dasharray="' + (l[2] === '4' ? '2 2' : '5 3') + '" stroke-width="1"/>' +
        '<text x="' + (padL - 4) + '" y="' + (y(l[0]) + (l[2] === '4' ? 7 : 1)) + '" font-size="8" text-anchor="end" fill="' + l[1] + '">' + l[2] + '</text>';
    });
    for (var i = 0; i < 2; i++) {
      if (vals[i] !== null && vals[i + 1] !== null) s += '<line x1="' + x(i) + '" y1="' + y(vals[i]) + '" x2="' + x(i + 1) + '" y2="' + y(vals[i + 1]) + '" stroke="#0f4c5c" stroke-width="2"/>';
    }
    rs.forEach(function (r, i) {
      s += '<text x="' + x(i) + '" y="' + (H - 4) + '" font-size="8" text-anchor="middle" fill="#6b7882">' + ['pre', 'during', '+1 wk'][i] + '</text>';
      if (vals[i] === null) {
        s += '<text x="' + x(i) + '" y="' + (y(yMax / 2)) + '" font-size="8" text-anchor="middle" fill="#5b4b8a" font-weight="700">NS</text>';
        return;
      }
      var g = R.grade(r, TH);
      var col = R.isFail(g) ? (g.sev >= 2 ? '#7a0d10' : '#a4161a') : '#2f6b3f';
      s += '<circle cx="' + x(i) + '" cy="' + y(vals[i]) + '" r="3.6" fill="' + col + '"><title>' + esc(short(param) + ' ' + vals[i] + ' (' + B.PHASE[r.phase].en + ')') + '</title></circle>' +
        '<text x="' + x(i) + '" y="' + (y(vals[i]) - 6) + '" font-size="8.5" text-anchor="middle" fill="' + col + '" font-weight="700">' + vals[i] + '</text>';
    });
    return s + '</svg>';
  }

  function strips(a, param) {
    return '<div class="strips">' + a.events.map(function (e) {
      if (e.status === 'missing') {
        return '<div class="strip missing"><h4>' + esc(e.key) + '</h4><p>No table in the ' + esc(e.year) + ' report.<br>Not evidence of clean water.</p></div>';
      }
      return '<div class="strip"><h4><span>' + esc(e.key) + '</span>' + pdf(e.year, e.page, 'p.' + e.page) + '</h4>' + strip(e, param) + '</div>';
    }).join('') + '</div>';
  }

  // ---------- readings grid ----------
  var gridFilter = { year: 'all', festival: 'all', phase: 'all', parameter: 'all' };

  function gridHtml(a) {
    var params = R.CLASS_B_PARAMS.concat(unique(ds.readings.map(function (r) { return r.parameter; })).filter(function (p) { return R.CLASS_B_PARAMS.indexOf(p) === -1; }));
    if (gridFilter.parameter !== 'all') params = params.filter(function (p) { return p === gridFilter.parameter; });
    var events = a.events.filter(function (e) {
      return (gridFilter.year === 'all' || e.year === gridFilter.year) && (gridFilter.festival === 'all' || e.festival === gridFilter.festival);
    });
    var phases = R.PHASES.filter(function (p) { return gridFilter.phase === 'all' || p === gridFilter.phase; });
    if (!events.length || !params.length) return '<p class="muted">No events match these filters.</p>';
    var head1 = '<tr><th class="param" rowspan="2">Parameter</th>' + events.map(function (e) {
      return '<th colspan="' + phases.length + '">' + esc(e.key) + (e.page ? '<br>' + pdf(e.year, e.page, 'p.' + e.page) : '<br><span class="warn-inline">no table</span>') + '</th>';
    }).join('') + '</tr>';
    var head2 = '<tr>' + events.map(function () { return phases.map(function (p) { return '<th>' + PHASE_SHORT[p] + '</th>'; }).join(''); }).join('') + '</tr>';
    var body = '';
    var groupShown = false;
    params.forEach(function (p) {
      var isB = R.CLASS_B_PARAMS.indexOf(p) !== -1;
      if (!isB && !groupShown) {
        body += '<tr class="group"><th colspan="' + (1 + events.length * phases.length) + '">No CPCB Class B limit: shown for context, never as an exceedance</th></tr>';
        groupShown = true;
      }
      var lim = TH.classB[p];
      var limTxt = !lim ? '' : p === 'pH' ? ' (6.5–8.5)' : lim.min != null ? ' (≥ ' + lim.min + ')' : ' (≤ ' + lim.max + ')';
      body += '<tr><th class="param">' + esc(p) + '<small class="muted">' + esc(limTxt) + '</small></th>';
      events.forEach(function (e) {
        phases.forEach(function (ph) {
          if (e.status === 'missing') { body += '<td class="v-missing">no table</td>'; return; }
          var r = e.readings.filter(function (x) { return x.parameter === p && x.phase === ph; })[0];
          if (!r) { body += '<td class="v-ns">not in table</td>'; return; }
          if (r.status === 'bdl') { body += '<td class="v-bdl" title="Below detection limit: very low, not zero, not missing">BDL</td>'; return; }
          if (r.status === 'nd') { body += '<td class="v-bdl" title="Not detected">ND</td>'; return; }
          if (r.status === 'not_sampled') { body += '<td class="v-ns" title="Not sampled. Printed in report as: ' + esc(r.printed || 'blank') + '">NS' + (r.printed ? ' ' + esc(r.printed) : '') + '</td>'; return; }
          var g = R.grade(r, TH);
          var cls = g === 'nolimit' ? 'v-nolimit' : g === 'pass' ? 'v-pass' : g.sev >= 2 ? 'v-sev' : 'v-fail';
          body += '<td class="' + cls + '">' + esc(r.value) + '</td>';
        });
      });
      body += '</tr>';
    });
    return '<div class="tablewrap"><table class="grid">' + head1 + head2 + body + '</table></div>' +
      '<div class="keyrow"><span><i class="sw sev"></i>DO below 4 (or 0)</span><span><i class="sw fail"></i>Fails Class B</span><span><i class="sw pass"></i>Meets Class B</span>' +
      '<span><i class="sw ns"></i>NS = not sampled (missing, not clean)</span><span><i>BDL</i> = below detection limit (very low, not zero)</span><span>Units assumed: mg/l; turbidity NTU; conductivity µS/cm</span></div>';
  }

  function unique(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  // ---------- case file ----------
  function renderCase(id) {
    var a = byId[id];
    if (!a) { app.innerHTML = '<div class="wrap"><p>Unknown ghat. <a href="#/">Back to the board</a></p></div>'; return; }
    var reasons = B.reasons(a);
    var acts = B.actions(a, 'en');
    var ng = (D.config.newGhats || []).filter(function (n) { return n.id === a.ghat.id; })[0];

    var gapItems = a.gaps.map(function (g) { return '<li>' + esc(B.gapText(g, a)) + '</li>'; });
    a.olderGaps.forEach(function (r) {
      gapItems.push('<li class="muted">Older gap: ' + esc(r.parameter + ' not sampled, ' + r.festival + ' ' + r.year + ', ' + B.PHASE[r.phase].en) + ' (printed "' + esc(r.printed || 'blank') + '", ' + pdf(r.year, r.page, 'p.' + r.page) + ')</li>');
    });
    gapItems.push('<li>2026 use or authorisation of this site has not been verified.' + (a.ghat.waterBody && /Upper Lake|Lower Lake/.test(a.ghat.waterBody) ? ' It sits on the ' + esc(a.ghat.waterBody) + ', where the NGT has banned immersion.' : '') + '</li>');
    gapItems.push('<li>Coliform was not tested, so bathing suitability with respect to bacteria cannot be assessed.</li>');

    var html = '<div class="wrap"><div class="crumbs"><a href="#/">← Action board</a></div>' +
      '<div class="case-head"><div class="bigrank">' + rankLabel(a) + '<small>' + (a.rank === null ? 'not ranked' : a.joint ? 'joint priority' : 'priority') + '</small></div>' +
      '<div style="flex:1;min-width:260px"><h1>' + esc(a.ghat.name) + ' <span lang="hi" class="muted" style="font-size:1rem">' + esc(B.NAMES_HI[a.ghat.name] || '') + '</span></h1>' +
      '<div class="muted">' + esc(a.ghat.waterBody || '') + (a.sampledCount ? ' · ' + a.sampledCount + ' of ' + a.eventCount + ' festival events sampled, 2023–2025' : '') + '</div>' +
      '<div class="chips">' + laneChip(a.lane) + evChip(a) + confChip(a) + extraChips(a) + '</div></div>' +
      '<a class="cta" href="#/plan">Action plan →</a></div>';

    html += '<div class="two"><section class="panel"><h2>Why this priority</h2>' +
      reasons.map(function (r) {
        var refs = r.refs.slice(0, 12).map(refChip).join('');
        var more = r.refs.length > 12 ? '<span class="muted" style="font-size:.78rem">+' + (r.refs.length - 12) + ' more in the readings grid below</span>' : '';
        return '<div class="reason ' + r.kind + '"><div>' + esc(r.text) + '</div>' + (refs ? '<div class="refs">' + refs + more + '</div>' : '') + '</div>';
      }).join('') +
      (ng ? '<p>' + esc(ng.note) + '</p><p><a href="' + esc(ng.source.url) + '" target="_blank" rel="noopener">' + esc(ng.source.title) + ' ↗</a></p>' : '') +
      '</section><div>' +
      '<section class="panel"><h2>Suggested actions <span class="tag-s">decision support</span></h2><ul class="actions">' +
      acts.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<p class="muted" style="font-size:.8rem;margin:8px 0 0">Suggestions for the officer\'s judgment, subject to the site\'s 2026 status.</p></section>' +
      '<section class="panel"><h2>Gaps &amp; uncertainty</h2><ul class="gaplist">' + gapItems.join('') + '</ul></section>' +
      '</div></div>';

    if (a.sampledCount) {
      if (a.ghat.siteMatch && a.ghat.siteMatch !== 'high') {
        html += '<section class="panel"><h2>Site names as printed in the reports</h2><table class="src">' +
          Object.keys(a.ghat.printedNames).sort().map(function (k) { return '<tr><td style="width:140px">' + esc(k) + '</td><td>' + esc(a.ghat.printedNames[k].join(' | ')) + '</td></tr>'; }).join('') +
          '</table><p class="muted" style="margin-top:6px">Ganesh and Durga tables use different names. They may be two places, so treat the comparison across festivals with caution.</p></section>';
      }
      html += '<section class="panel"><h2>Dissolved oxygen by event <small class="muted">before → during → one week after</small></h2>' + strips(a, 'Dissolved oxygen') +
        '<div class="legend"><span><i style="border-color:#a4161a"></i>5 mg/l Class B minimum</span><span><i style="border-color:#7a0d10;border-top-style:dotted"></i>4 mg/l Class C/D minimum</span><span>NS = not sampled</span></div></section>';
      html += '<section class="panel"><h2>BOD by event <small class="muted">limit 3 mg/l or less</small></h2>' + strips(a, 'BOD') + '</section>';
      html += '<section class="panel"><h2>All readings</h2><div class="filters">' +
        sel('year', 'Year', ['all'].concat(ds.years.slice().reverse())) +
        sel('festival', 'Festival', ['all', 'Durga', 'Ganesh']) +
        sel('phase', 'Phase', ['all'].concat(R.PHASES)) +
        sel('parameter', 'Parameter', ['all'].concat(R.CLASS_B_PARAMS, unique(ds.readings.map(function (r) { return r.parameter; })).filter(function (p) { return R.CLASS_B_PARAMS.indexOf(p) === -1; }))) +
        '</div><div id="grid">' + gridHtml(a) + '</div></section>';
      html += '<section class="panel"><h2>Sources</h2><table class="src"><tr><th>Event</th><th>Report</th><th>Page</th><th>Site name as printed</th></tr>' +
        a.events.map(function (e) {
          if (e.status === 'missing') return '<tr><td>' + esc(e.key) + '</td><td>' + esc(R.REPORTS[e.year].title) + '</td><td class="warn-inline">no table for this ghat</td><td>–</td></tr>';
          return '<tr><td>' + esc(e.key) + '</td><td>' + esc(R.REPORTS[e.year].title) + '</td><td>' + pdf(e.year, e.page, 'p.' + e.page) + '</td><td>' + esc(e.readings[0].sitePrinted) + '</td></tr>';
        }).join('') + '</table></section>';
    }
    html += '</div>';
    app.innerHTML = html;

    app.querySelectorAll('.filters select').forEach(function (s) {
      s.addEventListener('change', function () {
        gridFilter[s.name] = s.value;
        document.getElementById('grid').innerHTML = gridHtml(a);
      });
    });
  }

  function sel(name, label, opts) {
    return '<label>' + label + '<select name="' + name + '">' + opts.map(function (o) {
      var t = o === 'all' ? 'All' : R.PHASES.indexOf(o) !== -1 ? B.PHASE[o].en : o;
      return '<option value="' + esc(o) + '"' + (gridFilter[name] === o ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('') + '</select></label>';
  }

  // ---------- plan ----------
  var planLang = 'both';

  function planDoc(plan) {
    var hi = plan.lang === 'hi';
    return '<article class="doc" lang="' + plan.lang + '">' +
      '<h1>' + esc(plan.title) + '</h1><p class="sub">' + esc(plan.subtitle) + '</p>' +
      '<div class="disc">' + esc(plan.limits[0]) + ' ' + esc(plan.limits[6]) + '</div>' +
      '<p><b>' + esc(plan.headline) + '</b></p><p class="muted">' + esc(plan.method) + '</p>' +
      '<table><tr>' + plan.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>' +
      plan.rows.map(function (r) {
        return '<tr><td class="rk">' + esc(r.rank) + '</td><td><b>' + esc(r.name) + '</b>' + (r.identityWarning ? '<br><span class="warn-inline">⚠ ' + (hi ? 'स्थल-पहचान अनिश्चित' : 'site identity uncertain') + '</span>' : '') +
          '</td><td>' + laneChipLang(r) + '</td><td>' + esc(r.reason) + '</td><td><ul>' + r.actions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
          '</ul></td><td class="src-col">' + (r.pages.length ? r.pages.map(function (p) {
            var m = p.match(/(\d{4}).*?(\d+)$/);
            return m ? '<a target="_blank" rel="noopener" href="' + esc(R.sourceLink(m[1], Number(m[2]))) + '">' + esc(p) + '</a>' : esc(p);
          }).join('<br>') : '–') + '</td></tr>';
      }).join('') + '</table>' +
      '<h2>' + esc(plan.samplingTitle) + '</h2><ul>' + plan.sampling.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '<h2>' + esc(plan.limitsTitle) + '</h2><ul>' + plan.limits.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '<p class="foot-note">' + esc(plan.footer) + ' ' + (hi ? 'तैयार: ' : 'Prepared: ') + new Date().toLocaleDateString(hi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) + '</p>' +
      '</article>';
  }
  function laneChipLang(r) { return '<span class="lane lane-' + r.laneKey + '">' + esc(r.lane) + '</span>'; }

  function renderPlan() {
    var en = B.buildPlan(assessed, stats, 'en'), hi = B.buildPlan(assessed, stats, 'hi');
    var docs = (planLang !== 'hi' ? planDoc(en) : '') + (planLang !== 'en' ? planDoc(hi) : '');
    app.innerHTML = '<div class="wrap"><div class="crumbs"><a href="#/">← Action board</a></div>' +
      '<div class="toolbar"><div class="seg" role="group" aria-label="Language">' +
      ['en', 'hi', 'both'].map(function (l) {
        return '<button class="btn" data-lang="' + l + '" aria-pressed="' + (planLang === l) + '">' + { en: 'English', hi: 'हिन्दी', both: 'Both / दोनों' }[l] + '</button>';
      }).join('') + '</div>' +
      '<button class="btn primary" id="print">Print / save as PDF</button>' +
      '<button class="btn" data-copy="en">Copy English text</button><button class="btn" data-copy="hi">हिन्दी टेक्स्ट कॉपी करें</button>' +
      '<span class="toast" id="toast" aria-live="polite"></span></div>' + docs + '</div>';

    app.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { planLang = b.getAttribute('data-lang'); renderPlan(); });
    });
    document.getElementById('print').addEventListener('click', function () { window.print(); });
    app.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var lang = b.getAttribute('data-copy');
        copyText(B.planToText(lang === 'hi' ? hi : en), function (ok) {
          document.getElementById('toast').textContent = ok ? (lang === 'hi' ? 'हिन्दी टेक्स्ट कॉपी हो गया' : 'English text copied') : 'Copy failed: select the text and copy manually';
        });
      });
    });
  }

  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback()); });
    } else done(fallback());
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
  }

  // ---------- method ----------
  function renderMethod() {
    var crit = D.criteria;
    app.innerHTML = '<div class="wrap method"><h1>Method, data and limits</h1>' +
      '<div class="panel"><h2>Which CPCB class, and why</h2><p>We compare readings with <b>CPCB Class B, organised outdoor bathing</b>, because people enter the water at visarjan. ' +
      'Class B sets limits for only four parameters, and only three of them were tested: dissolved oxygen (≥ 5 mg/l), BOD (≤ 3 mg/l) and pH (6.5–8.5). ' +
      'Total coliform (≤ 500 MPN/100 ml) is the fourth, and it was <b>never tested</b>. The other ten parameters, including the four metals, have no Class B limit and are shown as context only. ' +
      'We use the Class C/D dissolved-oxygen minimum (4 mg/l) only as a severity step.</p>' +
      '<table><tr><th>Class</th><th>Use</th><th>Parameter</th><th>Limit</th></tr>' + crit.map(function (c) {
        return '<tr' + (c['class'] === 'B' ? ' style="background:#fff8e6"' : '') + '><td>' + esc(c['class']) + '</td><td>' + esc(c.designated_best_use) + '</td><td>' + esc(c.parameter) + '</td><td>' + esc(c.limit_type + ' ' + c.limit + ' ' + c.unit) + '</td></tr>';
      }).join('') + '</table><p class="muted">Source: data/source/cpcb_water_quality_criteria.csv, from https://cpcb.gov.in/water-quality-criteria/</p></div>' +

      '<div class="panel"><h2>Ranking rules (deterministic, no weights)</h2><table>' +
      '<tr><th>Step</th><th>Rule</th></tr>' +
      '<tr><td>Event</td><td>One ghat, one year, one festival (up to 6 per ghat). An event is <i>sampled</i> if it has at least one measured or BDL/ND reading.</td></tr>' +
      '<tr><td>Reading grade</td><td>DO = 0 → zero oxygen recorded; DO &lt; 4 → below the Class C/D minimum; DO &lt; 5, BOD &gt; 3, pH outside 6.5–8.5 → fails Class B. Other parameters: no limit.</td></tr>' +
      '<tr><td>Evidence HIGH</td><td>DO &lt; 4 in 2 or more sampled events, or in the most recent sampled Durga event.</td></tr>' +
      '<tr><td>Evidence MEDIUM</td><td>At least one Class B failure in at least half of the sampled events.</td></tr>' +
      '<tr><td>Evidence LOW / NONE</td><td>LOW: neither of the above. NONE: no sampled events; never treated as clean.</td></tr>' +
      '<tr><td>Order</td><td>Evidence level → number of events with DO &lt; 4 → number of events with DO = 0. Equal keys share a joint rank.</td></tr>' +
      '<tr><td>Coverage gaps</td><td>G1: a 2025 event has no table, or nothing was sampled. G2: a 2025 event lacks DO, BOD or pH at any phase. G3: site-match confidence below high. Older gaps are listed but do not count.</td></tr>' +
      '<tr><td>Lane</td><td>HIGH + adequate → Act. HIGH + gaps → Act and verify. MEDIUM/LOW + gaps → Verify first. MEDIUM + adequate → Watch. LOW + adequate → Routine. NONE → Establish baseline.</td></tr>' +
      '<tr><td>Why DO drives the order</td><td>BOD fails at every ghat (' + stats.bodAboveB + ' of ' + stats.bodMeasured + ' readings), so it cannot separate ghats. It is reported for each ghat and in the plan.</td></tr>' +
      '</table></div>' +

      '<div class="panel"><h2>How values are handled</h2><table><tr><th>In the report</th><th>Stored as</th><th>Treated as</th><th>Rows</th></tr>' +
      '<tr><td>A number</td><td>measured</td><td>Graded against Class B where a limit exists</td><td>' + stats.statusCounts.measured + '</td></tr>' +
      '<tr><td>BDL</td><td>bdl</td><td>Below detection: very low, not zero, not missing. No Class B limit applies to any BDL row</td><td>' + (stats.statusCounts.bdl || 0) + '</td></tr>' +
      '<tr><td>ND</td><td>nd</td><td>Not detected; kept separate. None in the Bhopal file</td><td>' + (stats.statusCounts.nd || 0) + '</td></tr>' +
      '<tr><td>Blank, _, -, *, **</td><td>not_sampled</td><td>Missing. Never a pass. Printed symbol kept</td><td>' + stats.statusCounts.not_sampled + '</td></tr>' +
      '<tr><td>No table in the report</td><td>missing event</td><td>Shown as missing; sets a coverage gap</td><td>' + R.missingEvents(ds).length + ' events</td></tr>' +
      '</table></div>' +

      '<div class="panel"><h2>Source reports</h2><table><tr><th>Year</th><th>Report</th><th>Pages</th><th>Original URL</th></tr>' +
      Object.keys(R.REPORTS).map(function (y) {
        var r = R.REPORTS[y];
        var url = { '2023': 'https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf', '2024': 'https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf', '2025': 'https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf' }[y];
        return '<tr><td>' + y + '</td><td><a target="_blank" rel="noopener" href="reports/' + esc(r.file) + '">' + esc(r.title) + '</a> (local copy)</td><td>' + r.pages + '</td><td>' + esc(url) + '</td></tr>';
      }).join('') + '</table><p class="muted">Readings come from the organisers\' cleaned file data/source/bhopal_ghats_2023_2025.csv, which the organisers spot-checked against these PDFs. The page numbers are PDF page numbers; links open the local copy at that page.</p></div>' +

      '<div class="panel"><h2>Limitations</h2><ul>' + B.limitations(stats, 'en').map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
      '<li>Only 6 festival events per ghat over 3 years: too few to claim trends. We show what was measured, not where it is heading.</li>' +
      '<li>The statewide file (21,600 rows) is not used: it was not checked table by table and is outside this officer\'s decision.</li></ul></div>' +
      '</div>';
  }

  // ---------- router ----------
  function route() {
    var h = location.hash.replace(/^#/, '') || '/';
    var m;
    closeModal();
    if ((m = h.match(/^\/ghat\/([\w-]+)/))) { renderCase(m[1]); setNav(''); }
    else if (h.indexOf('/plan') === 0) { renderPlan(); setNav('plan'); }
    else if (h.indexOf('/method') === 0) { renderMethod(); setNav('method'); }
    else { renderBoard(); setNav('board'); }
    window.scrollTo(0, 0);
  }
  function setNav(r) {
    document.querySelectorAll('.nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-route') === r); });
  }
  window.addEventListener('hashchange', route);
  route();
}());
