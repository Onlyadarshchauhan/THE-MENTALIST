# Methodology

All rules are in `assets/rules.js`. They are deterministic, with no weights, no machine learning and no AI-generated text. Tests are in `test/`.

## 1. Which CPCB class, and why

We use **Class B, organised outdoor bathing**, because people enter the water at visarjan. Class B sets limits for four parameters:

| Parameter | Class B limit | Tested 2023–25? |
|---|---|---|
| Dissolved oxygen (DO) | ≥ 5 mg/l | Yes (116 measured) |
| BOD (5 days, 20 °C) | ≤ 3 mg/l | Yes (112 measured) |
| pH | 6.5–8.5 | Yes (115 measured) |
| Total coliform | ≤ 500 MPN/100 ml | **Never tested** |

The DO minimum for Class C and Class D (wildlife and fisheries), **4 mg/l**, is used only as a severity step. COD, the solids, turbidity, conductivity and the four metals (chromium, lead, zinc, copper) have **no Class B limit**. They are displayed as context and never counted as exceedances. Conductivity is never above the Class E reference of 2,250 µS/cm; the maximum recorded is 1,882.

All thresholds are read from `data/source/cpcb_water_quality_criteria.csv`, not typed in by hand.

## 2. How each value is handled

| In the CSV | Status | Treatment |
|---|---|---|
| Number | `measured` | Graded where a Class B limit exists |
| `BDL` | `bdl` | Below detection limit: very low, not zero, not missing (174 rows, none on DO/BOD/pH) |
| `ND` | `nd` | Not detected, kept separate (none in the Bhopal file) |
| Blank, `_`, `-`, `*`, `**` | `not_sampled` | Missing; never a pass. The printed symbol is kept (61 rows) |
| No table in the report | missing event | Created explicitly: Bairagarh and Malikhedi, Durga 2025 |
| Unknown flag; BDL/ND on DO, BOD or pH; page outside the report | — | **Build stops** for manual review |

The source CSV is never modified. The values as printed, the site names as printed and the source pages pass through unchanged, and a test checks this.

## 3. Evidence (what was measured)

An **event** is one ghat in one year at one festival, so each ghat has up to 6. An event is **sampled** if it has at least one measured, BDL or ND reading.

Each reading is graded:

| Reading | Grade |
|---|---|
| DO = 0 | zero dissolved oxygen recorded |
| DO < 4 | below the Class C/D minimum |
| DO < 5 | fails Class B |
| BOD > 3 | fails Class B |
| pH outside 6.5–8.5 | fails Class B |

Each ghat is then given an evidence level:

| Level | Rule |
|---|---|
| HIGH | DO < 4 in ≥ 2 sampled events, **or** in the most recent sampled Durga event |
| MEDIUM | ≥ 1 Class B failure in at least half of the sampled events |
| LOW | Neither of the above |
| NONE | No sampled events (never treated as clean) |

**Order:** evidence level, then the number of events with DO < 4, then the number of events with DO = 0. Equal keys share a **joint** rank. We do not invent tie-breakers.

**Why DO sets the order:** BOD exceeds the limit at every ghat (100 of 112 readings), so it cannot tell ghats apart. Persistent BOD failures are still reported for every ghat: in the board, the case file and the plan.

## 4. Confidence (how complete the record is)

A ghat has **gaps** if any of these is true; otherwise its coverage is **adequate**:

- **G1:** a 2025 event has no table in the report, or nothing in it was sampled.
- **G2:** a sampled 2025 event lacks a measured DO, BOD or pH value at any phase.
- **G3:** the site-match confidence is below high (Rani Kamlapati ghat / Kamla Park kund).

Gaps in older years are listed in the case file but do not change confidence.

**Confidence never changes the order.** It changes the suggested action. A test flips confidence on every ghat and checks that the ranks are unchanged.

## 5. Lanes and suggested actions

| Evidence | Confidence | Lane | Suggested action |
|---|---|---|---|
| HIGH | adequate | Act | Review cleaning and aeration arrangements before visarjan; request sampling during immersion and one week after |
| HIGH | gaps | Act and verify | As above, plus a pre-immersion sample (G1/G2) or confirmation of the site identity (G3) |
| MEDIUM/LOW | gaps | Verify first | Request a fresh sample before deciding |
| MEDIUM | adequate | Watch | Keep in routine before/after sampling (BOD exceeded) |
| LOW | adequate | Routine | Routine sampling |
| NONE | — | Establish baseline | Request a baseline sample before first use |

Every plan also asks for **total coliform** to be included: it is the only Class B criterion never tested.

## 6. Checks that guard against misleading results

- **Headline statistics** are reproduced exactly: 42/116 DO < 5, 100/112 BOD > 3, 4 zero-DO readings with their pages, and 32/37 pre-immersion BOD > 3.
- **Blanking data never helps a ghat.** Blanking any single measured reading never adds a pass and never produces "Routine". Blanking any 2025 DO/BOD/pH reading always produces a coverage gap.
- **No readings means no ranking.** A ghat with no readings is "Establish baseline" and is unranked.
- **Source pages are checked.** Every page is inside its report. `scripts/verify-pages.js` found the printed value and site name on the cited page for 343 of 343 measured DO/BOD/pH readings. This shows the number appears on that page; it is not a cell-by-cell proof.
- **The plan text is screened.** It must contain the required caveats in both languages. A claim checker rejects words such as "safe", "disease", "predict" and "real-time", while allowing negations such as "not live monitoring".

## 7. What the data does not establish

- **Conditions now:** these are historical 2023–2025 readings, not live monitoring. They do not describe October 2026.
- **Bacteria:** coliform was not tested, so bathing suitability with respect to bacteria cannot be assessed.
- **Health effects:** none are claimed.
- **Cause:** immersion alone is not shown to cause the pollution, because the baseline already fails.
- **Units:** the reports print none, so the standard unit for each test is assumed.
- **2026 status:** use or authorisation of these ghats in 2026 is not verified. The NGT has banned immersion in the Upper and Lower Lakes.
- **Site identity:** the Rani Kamlapati / Kamla Park readings may come from two different places.
- **Trends:** six events per ghat are too few to claim them.
