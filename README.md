# Visarjan Ghat Watch: Pre-Visarjan Action Plan

Evidence-driven water-quality prioritisation and pre-visarjan action planning for Bhopal's immersion ghats.

**Track:** 2, Visarjan Ghat Watch · Claude Impact Lab × Cerebras Café Compute, Bhopal, 11 October 2026
**Team:** THE MENTALIST
- Adarsh Singh Chauhan
- Abhishek Sahu
- Anubha Jain
- Anukalp Tripathi

## The user

The **Bhopal Municipal Corporation officer who plans Durga visarjan at the ghats** (20 October 2026). This officer decides where extra cleaning, aeration and water testing go.

## What it does

It turns 1,524 MPPCB readings from the 2023–2025 visarjan reports into a ranked, evidence-linked answer to one question: *where should BMC act first before visarjan, where must it test first, and how sure are we?*

Every rank is traceable to the readings, the CPCB Class B limits, and the PDF page they came from. Missing data is shown as missing, never as clean. One click produces a printable **Hindi and English action plan** the officer can forward.

**What the data shows that a basic dashboard misses:**

1. **The water already failed before immersion.** 32 of 37 BOD readings taken *before* immersion were above the bathing limit, so the data does not show that immersion alone causes the pollution. Cleaning and aeration matter before the day.
2. **The worst-recorded ghat has the least recent evidence.** Bairagarh (Sant Hirdaram) kund recorded zero dissolved oxygen 4 times. The 2025 report has no Durga table for it, and its Ganesh 2025 sample was taken during immersion only. A "latest year" or averaged ranking would hide it.
3. **Uncertainty decides the action, not the order.** Gaps in the record add "request a sample" to the suggested action. They never move a ghat up or down the list.

## Demo

Recording: *(add link after recording)*. The two-minute script is in [DEMO.md](DEMO.md).

## How to run

1. Download this repository (green **Code** button → *Download ZIP*, then unzip) or `git clone https://github.com/Onlyadarshchauhan/THE-MENTALIST.git`.
2. Open `index.html` in Chrome or Edge (double-click it). No install, internet connection, server or API key is needed.
3. Click any ghat for its case file, any reading for its source PDF page, and **Action plan** for the bilingual brief (Print / Copy).

Optional, for developers (needs Node.js 18 or later; no packages):

4. `node --test` runs the 32 automated checks. `node scripts/build-data.js` rebuilds `data/generated/data.js` after the source CSV changes.

## What works, what does not

**Works (verified on 11 Oct 2026):**
- **Action board:** evidence × coverage matrix with deterministic ranks, including joint ranks, and plain-language reasons.
- **Ghat case files:**
  - Reasons tied to specific readings.
  - Before / during / one-week-after charts for DO and BOD.
  - A full readings grid with year, festival, phase and parameter filters.
  - BDL, not-sampled and missing-event cells marked distinctly.
  - Source table with the site name exactly as printed.
- **Source links:** every reading links to the local copy of the MPPCB report at its PDF page. All 343 measured DO, BOD and pH values were found on their cited page by `scripts/verify-pages.js`.
- **Bilingual action plan:** printable, with copy-to-clipboard short text in English and Hindi. It includes sampling requests, caveats and a 2026-status warning.
- **Tests and checks:**
  - 32 automated tests: headline statistics, flags, missing events, ranking, monotonicity, source pages, plan caveats and the claim checker.
  - A headless browser check of every screen: 0 JavaScript errors, 0 broken PDF links, and no horizontal overflow at 1366, 1024 and 390 px widths.
  - Print to PDF: the English plan prints on its own pages, and the Hindi plan starts on a new page.

**Does not work yet / limitations:**
- **PDF page jump:** `#page=N` relies on the browser's built-in PDF viewer (Chrome and Edge support it). Automated checks confirm the link targets and page contents but cannot drive the PDF viewer itself. Other viewers may open page 1; the page number is always shown on the link.
- **Hindi review:** the Hindi text was written to match the English templates. It **needs review by a native Hindi speaker** before official use.
- **2026 status:** whether each ghat is used or authorised in 2026 is **not verified**. The new BMC ghats are shown only as "no readings exist"; we do not know their names or locations.
- **No map:** the data has no coordinates.
- **Statewide data not used:** `mp_immersion_sites_2023_2025.csv` was left out. It is less checked and outside this officer's decision.
- **No trends:** six events per ghat are too few to claim trends, so none are shown.

## Method in brief

Full detail: [METHODOLOGY.md](METHODOLOGY.md), and the **Method & limits** screen in the app.

- **Standard:** CPCB **Class B (organised outdoor bathing)**, because people enter the water at visarjan.
  - Limits: DO ≥ 5 mg/l, BOD ≤ 3 mg/l, pH 6.5–8.5.
  - Total coliform is the fourth Class B criterion and was never tested.
  - The DO minimum of 4 mg/l (Classes C and D) is used only as a severity step.
  - The other 10 parameters have no Class B limit and are shown as context only.
- **Evidence** (from measured readings only):
  - **HIGH:** DO < 4 in ≥ 2 events, or in the most recent Durga record.
  - **MEDIUM:** a Class B failure in at least half of the sampled events.
  - **NONE:** no readings. This is never treated as clean.
- **Order:** evidence level, then events with DO < 4, then events with DO = 0. Ties are joint.
- **Coverage gaps** (no 2025 table, unsampled 2025 phases, uncertain site identity) change the *action*, never the *order*.
- **BOD** exceeds the limit at every ghat (100 of 112 readings), so it cannot separate ghats. It is reported for every ghat and in the plan.

| Rank | Ghat | Lane | Main reason |
|---|---|---|---|
| 1 | Bairagarh (Sant Hirdaram) kund | Act and verify | DO < 4 in 4 of 5 events, zero in 3; no Durga 2025 table |
| 2 | Malikhedi kund | Act and verify | DO < 4 in 3 of 5 events; no Durga 2025 table |
| =3 | Rani Kamlapati ghat / Kamla Park kund | Act and verify | DO < 4 in 2 events incl. Durga 2025; site identity uncertain |
| =3 | Shahpura lake ghat | Act | DO < 4 in 2 events incl. Durga 2025 |
| 5 | Prempura ghat | Watch | DO < 4 in 1 event; BOD > 3 in 9 of 15 |
| =6 | Hathaikheda dam / kund | Watch | DO never < 4; BOD > 3 in 16 of 18 |
| =6 | Khatlapura ghat | Watch | DO never < 4; BOD > 3 in 15 of 17 |
| – | New BMC ghats | Establish baseline | No readings exist |

This is an algorithmic priority for planning. **It is not an official MPPCB or BMC risk classification.**

## Data used

**From the organisers' pack** ([github.com/Laaaaksh/bhopal-impact-lab-2026](https://github.com/Laaaaksh/bhopal-impact-lab-2026), `tracks/02-visarjan-ghat-watch`), copied unchanged into `data/source/` and `reports/`:

- **`bhopal_ghats_2023_2025.csv`:** 1,524 readings, 7 ghats. This is the only source of readings.
- **`cpcb_water_quality_criteria.csv`:** the only source of thresholds. Original: https://cpcb.gov.in/water-quality-criteria/
- **`DATA_DICTIONARY.md`:** the organisers' notes on the data.
- **MPPCB visarjan reports**, used for the source links:
  - 2023: https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf
  - 2024: https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf
  - 2025: https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf

These were downloaded by the organisers on 10 Oct 2026. We did not access any government portal.

**Extra public data:** none. The new-BMC-ghats note cites the Free Press Journal article (26 Feb 2026) listed in the organisers' guide: https://www.freepressjournal.in/amp/bhopal/mp-news-idol-immersion-to-shift-from-lakes-to-safer-sites-ngt-ban-pushes-bmc-to-build-4-dedicated-ghats

**Our own files:**
- `data/ghats_2026.json` holds the 2026 status of each ghat. All entries are currently "not verified".
- `data/generated/data.js` is built from the CSVs.

No personal data is used or collected. There are no API keys, secrets or network calls.

## Project layout

```
index.html                 the app (open directly)
assets/rules.js            data handling + ranking rules (shared by browser and tests)
assets/brief.js            reasons, actions, bilingual plan templates, claim checker
assets/app.js, styles.css  screens
data/source/               organisers' CSVs, unchanged
data/ghats_2026.json       2026 status per ghat (unverified) + new-ghat note
data/generated/data.js     built by scripts/build-data.js
reports/                   the three MPPCB reports (local copies for page links)
scripts/build-data.js      CSV → data.js; stops on any unknown flag or bad page
scripts/verify-pages.js    checks values appear on cited PDF pages (needs pdftotext)
scripts/browser-check.js   headless Chrome/Edge check of every screen
test/                      node --test suites
```

## Licence

MIT. See [LICENSE](LICENSE). The MPPCB reports and CPCB criteria are public government documents, included unchanged for traceability.
