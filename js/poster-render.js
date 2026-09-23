// poster-render.js — Efferon Carousel Studio: Poster Spec → the "P2 · airier"
// poster (1400×990, panels-on-white). Ported verbatim from
// poster-explore/p2-airy.html and parameterised by the Poster Spec produced by
// js/poster-model.js (newPoster()/demoPoster()).
//
// Isolated from the carousel engine: this module never imports or mutates
// deck-model.js. It reuses ONLY the shared text helpers from deck-render.js
// (richText / escapeHtml) so the {{coral|violet|blue:word}} emphasis tokens
// render identically to the carousel — and never leak.

import { richText, escapeHtml } from './deck-render.js';
import { posterCanvas } from './poster-model.js';

/* ================= constants ================= */

const LOGO_SRC = 'assets/logo/efferon-logo.svg';
const PRODUCT_SRC = 'assets/product/%D0%BA%D0%BE%D0%BB%D0%BE%D0%BD%D0%BA%D0%B0%20%D0%BB%D0%BF%D1%81.png';
const MICROBE_SRC = 'assets/illustrations/efferon%20ball%20illustration%201.png';

// series colour name -> brand hex (inlet coral, outlet blue, adsorption teal)
const SERIES_HEX = {
  coral: '#e16f79', blue: '#4568a9', violet: '#896896', teal: '#21b9aa',
};
// fallback by series name when no colour is given
const NAME_HEX = { inlet: '#e16f79', outlet: '#4568a9', adsorption: '#21b9aa' };

function seriesColor(s) {
  return SERIES_HEX[s.color] || NAME_HEX[(s.name || '').toLowerCase()] || '#4568a9';
}

/* ================= tiny helpers ================= */

// Resolve a data-supplied image path to a URL-safe src (leaves data:/http(s)).
function resolveSrc(path) {
  if (!path) return null;
  if (path.startsWith('data:') || /^https?:\/\//.test(path)) return path;
  return path.replace(/ /g, '%20');
}

function cap(s) {
  s = String(s || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// A result value is not always a number. "Reduced", "No significant improvement",
// "MAP up / PaO2:FiO2 up" are legitimate qualitative findings — but the hero
// 60px treatment is designed for "18.5-fold", and applying it to a phrase gives
// three lines of shouting instead of a poster. Classify, then let CSS scale.
function valueKind(v) {
  const t = String(v ?? '').trim();
  if (!t) return 'num';
  const looksNumeric = /^[^\p{L}]*\d/u.test(t) && t.length <= 14;
  if (looksNumeric) return 'num';        // 18.5-fold, 2.5, 87%, 24-72 h
  if (t.length <= 14) return 'word';     // Reduced, No change
  return 'phrase';                       // a statement, set as reading copy
}

// Split a metric value like "5%" / "12 %" / "4 h" into a big number + unit.
function splitValue(v) {
  const m = /^\s*([\d.,–—-]+)\s*(.*)$/.exec(String(v ?? ''));
  if (!m) return { num: String(v ?? ''), unit: '' };
  let [, num, unit] = m;
  // "18.5-fold" used to split as "18.5-" + "fold", leaving a hyphen dangling off
  // the big figure. A trailing separator belongs to the unit, not the number.
  const sep = /[–—-]$/.exec(num);
  if (sep && unit) { num = num.slice(0, -1); unit = sep[0] + unit; }
  return { num, unit };
}

// Build the <h1> title, highlighting titleEmphasis as the coral .hl pill.
// Everything else still runs through richText so any {{...}} tokens render too.
function titleHTML(header) {
  const title = header.title || '';
  const emph = (header.titleEmphasis || '').trim();
  if (!emph) return richText(title);
  const i = title.indexOf(emph);
  if (i < 0) return richText(title);
  const before = title.slice(0, i);
  const after = title.slice(i + emph.length);
  return `${richText(before)}<span class="hl">${richText(emph)}</span>${richText(after)}`;
}

/* ================= panels ================= */

function panelStats(stats) {
  if (!stats || !stats.length) return '';
  const items = stats.map((s) =>
    `<div class="p-stat"><div class="p-stat-v">${richText(s.value || '')}</div>` +
    `<div class="p-stat-l">${richText(s.label || '')}</div></div>`).join('');
  return `<div class="p-stats">${items}</div>`;
}

function panelChips(chips) {
  if (!chips || !chips.length) return '';
  const pills = chips.map((c) => `<span class="pill-drug">${richText(c)}</span>`).join('');
  return `<div class="drug-names">${pills}</div>`;
}

function renderPanel(panel, poster) {
  const tone = panel.tone === 'blue' ? 'blue' : 'soft';
  const showProduct = tone === 'soft' && poster.assets && poster.assets.productPhoto;

  const heading = panel.heading ? `<div class="p-kicker">${richText(panel.heading)}</div>` : '';
  const body = panel.body ? `<p class="p-text">${richText(panel.body)}</p>` : '';
  const stats = panelStats(panel.stats);
  const chips = panelChips(panel.chips);

  let inner;
  if (showProduct) {
    // body + tag pills on the left, product cartridge photo on the right
    inner = heading +
      `<div class="drug-row"><div class="drug-body">${body}${chips}</div>` +
      `<div class="product"><img src="${PRODUCT_SRC}" alt="Efferon® LPS cartridge"></div></div>` +
      stats;
  } else {
    inner = heading + body + stats + chips;
  }
  return `<div class="panel ${tone}">${inner}</div>`;
}

/* ================= results cards ================= */

function legendHTML(chart) {
  // series live on the chart (line/km/grouped-single) or on the first metric
  // group (grouped with multiple groups); donut/bars carry no series.
  let src = (chart.series && chart.series.length) ? chart.series : [];
  if (!src.length && chart.groups && chart.groups.length) {
    /* A grouped chart's series live PER GROUP, and taking group[0]'s names for the
       whole card printed one group's label over all of them: on a real poster the
       CRP p-value (p = 0.003) appeared as the single legend for CRP, IL-6 and
       TNF-alpha, which the content check correctly read as a significance claim
       the source never made. Share a legend only when every group agrees. */
    const names = chart.groups.map((g) => (g.series || []).map((x) => x && x.name).join('|'));
    const identical = names.every((n) => n === names[0]);
    src = identical ? (chart.groups[0].series || []) : [];
  }
  const series = src.filter((s) => s && s.name);
  if (!series.length) return '';
  const lgs = series.map((s) =>
    `<div class="lg"><span class="sw" style="background:${seriesColor(s)}"></span>${escapeHtml(cap(s.name))}</div>`
  ).join('');
  return `<div class="legend">${lgs}</div>`;
}

// A results card. It is one of three shapes, chosen per data so the row can mix
// freely (some cards a statistic, some a chart), NOT a forced number+chart pair:
//   1. pure STAT  — a headline figure, no plot: title on top, the number big and
//      centred (e.g. "4 days · Shorter ICU stay", "38.7% · cost reduction").
//   2. CHART      — a bars/donut/line/grouped/km plot, optionally with a hero
//      number in the header (e.g. the antibiotic "5% adsorbed" over its curve).
//   3. metric-less CHART — everything centred (the sepsis donut/km/bars cards).
// A stat comes from either a `metric` (results.metrics[]) or a chart of type
// "stat"; either way the number reads from value/unitLabel. There is NO default
// unit label — "adsorbed" is antibiotic-specific and must be set explicitly.
/**
 * One result card, in the "quiet card, locked baseline" language.
 *
 * The card this replaced put a centred bold title, then a centred grey caption,
 * then the figure, then a second grey caption — inside a white box with a border
 * AND a drop shadow. Two problems: the box chrome outweighed the content, and a
 * title that wrapped to two lines pushed its figure lower than its neighbours',
 * so the row of numbers stepped up and down. Hence, in fixed order:
 *
 *   heading  — small caps, brand blue, with a TWO-LINE RESERVE (.rk min-height)
 *   value    — one row of fixed min-height, bottom-aligned, so every figure in
 *              the row sits on the same baseline no matter the heading's length
 *   chart    — for chart cards, in the same slot as the value
 *   footnote — sub + unitLabel merged into ONE quiet line under a hairline
 *              (they used to sandwich the figure above and below it)
 *
 * The card keeps the `.stat` class name: js/poster-verify.js counts result cards
 * with it, and poster.css carries guards against carousel rules that target it.
 */
function statCard(chart, metric, opts = {}) {
  const title = (chart && chart.title) || (metric && metric.label) || '';
  const sub = (chart && chart.sub) || (metric && metric.sub) || '';
  const value = (metric && metric.value) || (chart && chart.value) || '';
  const unitLabel = (metric && metric.unitLabel) || (chart && chart.unitLabel) || '';
  // A 'values' card is a SET of same-unit measurements that are not being
  // compared with each other (three molecules each falling by n-fold, say).
  // It gets no plot: bars would draw a comparison the study never made, and
  // three similar bar heights carry no information the numbers do not.
  const isSet = !!chart && chart.type === 'values';
  const hasPlot = !!chart && chart.type !== 'stat' && !isSet;
  const span = chart && chart.span > 1 ? ` style="grid-column:span ${chart.span}"` : '';

  const { num, unit } = splitValue(value);
  const valueRow = value
    ? `<div class="rv is-${valueKind(value)}"><div class="num">${escapeHtml(num)}` +
      (unit ? `<span class="pct">${escapeHtml(unit)}</span>` : '') + `</div></div>`
    : '';

  // Donut cards lay out ring + caption as HTML; every other type renders as a
  // single inline SVG in the chartwrap.
  let chartBody = '';
  if (hasPlot) {
    chartBody = (chart.type === 'donut')
      ? `<div class="donut-wrap">${donutBlock(chart)}</div>`
      : `<div class="chartwrap">${posterChartSVG(chart, { showTitle: false, frac: opts.frac })}</div>`;
  }

  // The set: label + figure pairs on one shared baseline inside a single card.
  const setRow = isSet && (chart.values || []).length
    ? `<div class="rvset">${chart.values.map((v) => {
        const p = splitValue(v.value);
        return `<div class="rvitem"><div class="num">${escapeHtml(p.num)}` +
          (p.unit ? `<span class="pct">${escapeHtml(p.unit)}</span>` : '') + `</div>` +
          `<div class="rvlab">${richText(v.label || '')}</div></div>`;
      }).join('')}</div>`
    : '';

  const foot = [sub, unitLabel].filter(Boolean);
  return `<div class="stat"${span}>
    <div class="rk">${richText(title)}</div>
    ${valueRow}
    ${setRow}
    ${chartBody}
    ${hasPlot ? legendHTML(chart) : ''}
    ${foot.length ? `<div class="rsub">${foot.map((f) => richText(f)).join(' · ')}</div>` : ''}
  </div>`;
}

function resultsHTML(poster) {
  const results = poster.results || {};
  const metrics = results.metrics || [];
  const charts = poster.charts || [];

  if (!charts.length && !metrics.length && !results.note) return '';

  // Each metric is its OWN stat card and each chart its OWN chart card — the two
  // are no longer zipped index-by-index (that forced every card to be a number
  // AND a chart).
  //
  // Order: every figure-only card first, every PLOTTED card last. A plot card is
  // 2–3× taller than a figure card, so a plot landing mid-row left the short
  // cards beside it with a tall white hole underneath (grid rows are as tall as
  // their tallest cell). Sinking the plots to the end confines that to the last
  // row, and reads better too: the numbers arrive together.
  // 'values' draws no plot (it is labelled figures in one card), so it belongs
  // with the figure cards, not in the taller plot row.
  /* A card that carries no figure and no plot is an empty box: seen on a real
     poster as type:'values' with no values array at all, rendering as a heading
     over a hairline. Drop it here rather than print a hole; the spec still has it
     and the gate still reports a valueless card, so nothing is hidden. */
  const renderable = (c) => {
    const t = c.type || 'line';
    if (t === 'values') return !!(c.values && c.values.length);
    if (t === 'stat') return !!(c.value && String(c.value).trim());
    return true;                                  // a real plot type draws itself
  };
  const drawable = charts.filter(renderable);
  const cols0 = results.columns || 3;

  const plotted = drawable.filter((c) => c.type && c.type !== 'stat' && c.type !== 'values');
  const figures = drawable.filter((c) => !plotted.includes(c));

  // Figure cards and plot cards get SEPARATE grids. Equal heights within a row is
  // what she asked for, but a plot card is 2–3× a figure card, so mixing them in
  // one grid stretched "7 vs 12 days" to 400px and left 260px of empty tint inside
  // it. Two grids: figures equalise against figures, plots against plots.
  // A card carries its own width weight: 1 normally, chart.span when the spec
  // asks for a wide one. Rows are packed by weight, so a spanning card cannot
  // overflow the row it lands in. The HTML is rendered only once the row is
  // known, because a chart needs to know how wide its card will be.
  const weight = (c) => Math.max(1, Math.min(cols0, (c && c.span) || 1));
  const figureCards = [
    ...metrics.map((m) => ({ metric: m, chart: null, w: 1, plot: false })),
    ...figures.map((c) => ({ metric: null, chart: c, w: weight(c), plot: false })),
  ];
  const plotCards = plotted.map((c) => ({ metric: null, chart: c, w: weight(c), plot: true }));

  const head = results.note
    ? `<div class="results-head"><span class="results-pill">Results</span>` +
      `<div class="results-note">${richText(results.note)}</div></div>`
    : '';

  /* Rows are built explicitly, one grid per row, because a grid with a FIXED
     column count punches a hole the moment the cards do not fill it: two cards in
     a three-column row left a third of the row as bare page, and a lone plot card
     left two thirds of it empty under the numbers. That hole is what she kept
     pointing at. Balanced rows (five cards become 3 + 2, each row a grid of
     exactly its own width) are full by construction, and a row of two reads as
     two wide cards rather than two cards and a gap. */
  const rowsOf = (cards) => {
    const out = [];
    let row = [], w = 0;
    cards.forEach((c) => {
      if (row.length && w + c.w > cols0) { out.push(row); row = []; w = 0; }
      row.push(c); w += c.w;
    });
    if (row.length) out.push(row);
    // Balance the tail: 4 cards in 3 columns would be 3 + 1, which is a hole with
    // extra steps. Re-cut into rows of near-equal length instead (2 + 2).
    if (out.length > 1 && out[out.length - 1].length < out[0].length &&
        cards.every((c) => c.w === 1)) {
      const n = cards.length, rows = out.length, cut = [];
      let i = 0;
      for (let r = 0; r < rows; r++) {
        const take = Math.ceil((n - i) / (rows - r));
        cut.push(cards.slice(i, i + take));
        i += take;
      }
      return cut;
    }
    return out;
  };
  const gridRow = (row, cls) => {
    const span = row.reduce((a, c) => a + c.w, 0);
    // A row holding BOTH a chart and a plain figure is marked `mixed`: the figure
    // card is stretched to the chart's height, so its number is centred in the
    // card rather than left sitting under the heading above 200px of empty tint.
    const mixed = row.some((c) => c.plot) && row.some((c) => !c.plot) ? ' mixed' : '';
    const cards = row.map((c) => statCard(c.chart, c.metric, { frac: c.w / span })).join('');
    return `<div class="stats${cls}${mixed}" style="grid-template-columns:repeat(${span},1fr)">` +
      cards + `</div>`;
  };

  /* Figures and plots normally get their own rows: a plot card is 2-3x the height
     of a figure card, and mixing them in one grid stretched "7 vs 12 days" into
     400px of empty tint. When everything fits in a SINGLE row, that stretch is the
     thing she asked for instead: the numbers stand at the chart's full height, one
     row, one baseline, no gap. A lone chart is allowed a fourth seat in that row,
     because a chart on a row of its own is stretched the width of the poster and
     its bars cannot fill it. */
  const totalW = figureCards.reduce((a, c) => a + c.w, 0) + plotCards.reduce((a, c) => a + c.w, 0);
  const rowMax = plotCards.length === 1 && totalW === cols0 + 1 ? cols0 + 1 : cols0;
  /* A single figure card on a row of its own would be stretched the full width of
     the poster for the sake of one number. When there are plots to keep it
     company it joins their sequence instead, and the rows balance (1 + 3 becomes
     2 + 2) with the figure centred against the chart beside it. */
  const lonelyFigure = figureCards.length === 1 && plotCards.length >= 2;
  const body = totalW <= rowMax
    ? gridRow([...figureCards, ...plotCards], plotCards.length ? ' plots' : '')
    : lonelyFigure
      ? rowsOf([...figureCards, ...plotCards]).map((r) => gridRow(r, ' plots')).join('')
      : rowsOf(figureCards).map((r) => gridRow(r, '')).join('') +
        rowsOf(plotCards).map((r) => gridRow(r, ' plots')).join('');
  return `<div class="results">${head}${body}</div>`;
}

/* ================= brand charts (native inline SVG) ================= */

/**
 * posterChartSVG(chart[, {showTitle}]) — a small brand chart as an inline SVG
 * string. Which primitive is drawn is chosen by `chart.type` (default 'line',
 * so every existing deck/poster is unaffected). All primitives share the brand
 * palette (coral #e16f79, blue #4568a9, teal #21b9aa) and the muted #7d7d93
 * axis ink. Per-type DATA SHAPES:
 *
 *   type:'line' (default) — the original 2-axis line chart.
 *     { xlabels:['0','30',…], series:[{ name, color, points:[100,60,…] }] }
 *     null points are skipped (e.g. an outlet series that starts at 30 min).
 *
 *   type:'donut' — one or two rings, each a big centre value + caption. Used
 *     for a paired change readout (e.g. SOFA −3,4 vs +1,7). Rendered by the
 *     card as HTML+SVG (donutBlock), not through this function.
 *     { donuts:[ { value:'−3,4', tone:'good'|'bad', fraction:0..1, caption } ] }
 *     tone 'good' → teal ring, 'bad' → coral ring; fraction = arc fill.
 *
 *   type:'bars' — simple vertical bars for a small comparison. Value label
 *     above each bar, group label (+ optional note) beneath. Colour per bar.
 *     { unit:'%', max?, bars:[ { label, value, color, note } ] }
 *
 *   type:'grouped' — paired before/after bars (e.g. 0 h → 72 h) per series,
 *     optionally split into several named metric groups (CRP, Creatinine, …).
 *     { xlabels:['0 h','72 h'], unit?,
 *       series:[ { name, color, points:[from,to] } ]           // single group, OR
 *       groups:[ { name, unit, series:[ { name, color, points:[from,to] } ] } ] }
 *
 *   type:'km' — a stepped Kaplan–Meier survival curve, two arms, x = days.
 *     { xmax, xlabel, ylabel,
 *       series:[ { name, color, points:[[x,y],…], annot:{ x, y, text } } ] }
 *     y is a 0–100 survival %; each series steps down (step-after).
 *
 * When showTitle is true (line only) the title + sub are drawn above the plot;
 * the poster card passes showTitle:false because it prints its own heading.
 */
export function posterChartSVG(chart, opts = {}) {
  const type = (chart && chart.type) || 'line';
  if (type === 'bars') return barsSVG(chart, opts);
  if (type === 'grouped') return groupedBarsSVG(chart, opts);
  if (type === 'km') return kmSVG(chart);
  // 'donut' is rendered by the card (donutBlock); fall through to line for it
  // only if it ever reaches here without donuts.
  return lineChartSVG(chart, opts);
}

/** The original brand line chart (type:'line'). */
function lineChartSVG(chart, opts = {}) {
  const showTitle = opts.showTitle !== false; // default true (self-contained)
  const xlabels = (chart && chart.xlabels) || [];
  const series = (chart && chart.series) || [];

  // geometry (P2 proportions, scaled ~2× so #7d7d93 ~20px labels read cleanly)
  const W = 744;
  const plotL = 78, plotR = 720;
  const titleH = showTitle ? 66 : 0;
  const plotT = (showTitle ? 24 : 18) + titleH;
  // Shorter plot inside the results cards (showTitle:false) so a card — header +
  // hairline + chart + legend — stays compact and the poster never clips.
  const plotH = showTitle ? 210 : 150;
  const plotB = plotT + plotH;
  const H = plotB + (showTitle ? 62 : 54);

  const N = Math.max(xlabels.length, ...series.map((s) => (s.points || []).length), 1);
  const xAt = (i) => (N <= 1 ? plotL : plotL + (plotR - plotL) * (i / (N - 1)));
  const yAt = (v) => plotB - (v / 100) * plotH;

  // gridlines + y labels (0/25/50/75/100 = % from initial)
  let grid = '';
  [0, 25, 50, 75, 100].forEach((g) => {
    const yy = yAt(g).toFixed(1);
    grid += `<line x1="${plotL}" y1="${yy}" x2="${plotR}" y2="${yy}" stroke="rgba(43,47,86,.09)" stroke-width="1.4"/>`;
    grid += `<text x="${plotL - 14}" y="${(yAt(g) + 7).toFixed(1)}" text-anchor="end" font-size="20" fill="#7d7d93" font-family="'Gotham Pro',sans-serif">${g}</text>`;
  });

  // x-axis labels
  const xLabY = plotB + (showTitle ? 32 : 28);
  const capY = plotB + (showTitle ? 58 : 48);
  let xt = '';
  for (let i = 0; i < N; i++) {
    const lab = xlabels[i] != null ? xlabels[i] : '';
    xt += `<text x="${xAt(i).toFixed(1)}" y="${xLabY}" text-anchor="middle" font-size="20" fill="#7d7d93" font-family="'Gotham Pro',sans-serif">${escapeHtml(lab)}</text>`;
  }

  // one polyline + dots per series (skip null points)
  let lines = '';
  let dots = '';
  series.forEach((s) => {
    const color = seriesColor(s);
    const pts = [];
    (s.points || []).forEach((v, i) => {
      if (v == null) return;
      pts.push([xAt(i), yAt(v)]);
    });
    if (!pts.length) return;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    lines += `<path d="${d}" fill="none" stroke="${color}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    dots += pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6.4" fill="#fff" stroke="${color}" stroke-width="4"/>`).join('');
  });

  // optional title + sub above the plot
  let titleTxt = '';
  if (showTitle && chart) {
    if (chart.title) titleTxt += `<text x="${plotL - 14}" y="34" font-size="27" font-weight="700" fill="#2b2f56" font-family="'Gotham Pro',sans-serif">${escapeHtml(chart.title)}</text>`;
    if (chart.sub) titleTxt += `<text x="${plotL - 14}" y="60" font-size="19" fill="#7d7d93" font-family="'Gotham Pro',sans-serif">${escapeHtml(chart.sub)}</text>`;
  }

  const axis = `<line x1="${plotL}" y1="${plotB}" x2="${plotR}" y2="${plotB}" stroke="rgba(43,47,86,.22)" stroke-width="1.6"/>`;
  /* The axis caption is DATA, not decoration. It used to be the hardcoded string
     "time, min · % from initial", printed under every line chart whatever the
     chart showed — on a poster whose points were reductions at procedure
     milestones and day 5 that is simply a false axis, and the content check
     flagged it as fabricated on two separate posters. Now it prints only what the
     spec supplies (xlabel / ylabel), and nothing at all when the spec is silent. */
  const capBits = [chart && chart.xlabel, chart && chart.ylabel]
    .map((x) => (x == null ? '' : String(x).trim())).filter(Boolean);
  const caption = capBits.length
    ? `<text x="${((plotL + plotR) / 2).toFixed(1)}" y="${capY}" text-anchor="middle" font-size="18" fill="#7d7d93" font-family="'Gotham Pro',sans-serif">${escapeHtml(capBits.join(' · '))}</text>`
    : '';

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml((chart && chart.title) || 'chart')}">`
    + titleTxt + grid + axis + lines + dots + xt + caption + `</svg>`;
}

// Resolve a colour name ('coral'|'blue'|'teal'|'violet') or literal to a hex.
function chartColor(c) { return SERIES_HEX[c] || c || '#4568a9'; }

// Split a label into at most two centred lines (~budget chars each) so long
// group labels ("Control group") don't overflow a narrow card.
function wrapLabel(text, budget) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  const lines = ['', ''];
  let i = 0;
  words.forEach((w) => {
    if (i === 0 && (lines[0] + ' ' + w).trim().length > budget && lines[0]) i = 1;
    lines[i] = (lines[i] ? lines[i] + ' ' : '') + w;
  });
  return lines.filter(Boolean);
}

const SVG_FONT = "font-family=\"'Gotham Pro',sans-serif\"";

/* ---------- donut (ring + centre value + caption) — HTML+SVG ---------- */

function donutRing(value, color, frac) {
  const size = 118, sw = 15, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const fill = Math.max(0, Math.min(1, frac == null ? 0.6 : frac)) * c;
  const cx = size / 2, cy = size / 2;
  return `<svg class="donut-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8ecf3" stroke-width="${sw}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" `
    + `stroke-linecap="round" stroke-dasharray="${fill.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`
    + `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="30" `
    + `font-weight="700" fill="${color}" ${SVG_FONT}>${escapeHtml(value)}</text></svg>`;
}

// donutBlock(chart) → the flex row of ring + caption items (called by the card).
function donutBlock(chart) {
  const items = (chart.donuts || []).map((d) => {
    const color = d.tone === 'bad' ? SERIES_HEX.coral : SERIES_HEX.teal;
    return `<div class="donut-item">${donutRing(d.value, color, d.fraction)}`
      + `<div class="donut-cap">${richText(d.caption || '')}</div></div>`;
  }).join('');
  return `<div class="donut-row">${items}</div>`;
}

/* ---------- vertical bars ---------- */

/* How much wider than a one-third card this chart's card is. Both bar
   primitives are drawn in a near-square viewBox sized for a third of the poster;
   dropped into a half or full-width card, `meet` scaling letterboxed them and
   left bare tint on either side of the bars. Stretching the viewBox by the same
   factor as the card keeps the bars filling their card instead. */
/* SVG text is set in Gotham Pro, which has no superscript two: "mL/m²" came out
   as a tofu box on the pancreatitis poster. The character is rebuilt as a raised
   tspan instead, so the unit reads correctly whatever the font carries. */
function svgText(v) {
  return escapeHtml(String(v == null ? '' : v))
    .replace(/²/g, '<tspan baseline-shift="super" font-size="68%">2</tspan>')
    .replace(/³/g, '<tspan baseline-shift="super" font-size="68%">3</tspan>');
}

function widthFactor(opts) {
  const frac = (opts && opts.frac) || 1 / 3;
  return Math.max(1, Math.min(2.2, frac * 3));
}

function barsSVG(chart, opts = {}) {
  const bars = chart.bars || [];
  const unit = chart.unit || '';
  // Taller-than-wide viewBox so the chart fills a narrow (span-1) card and the
  // bars read big; plot leaves room for the value on top and label+note below.
  const k = widthFactor(opts);
  const W = Math.round(300 * k), plotT = 52, plotB = 214;
  const max = chart.max || Math.max(1, ...bars.map((b) => b.value)) * 1.18;
  const n = Math.max(bars.length, 1);
  const yAt = (v) => plotB - (v / max) * (plotB - plotT);
  // Centre the bar GROUP in the viewBox (equal left/right margins) so it always
  // reads centred in the card, regardless of the card's width.
  const gap = 44 * k;
  const bw = Math.min(92 * k, (W - 40 * k - gap * (n - 1)) / n);
  const groupW = n * bw + (n - 1) * gap;
  const startX = (W - groupW) / 2;

  // One label size for every bar — sized to the longest label so the set reads
  // as a set. Per-bar sizing made three different sizes in one chart.
  const slot = bw + gap * 0.86;
  const widestLabel = Math.max(1, ...bars.map((b) =>
    Math.max(1, ...wrapLabel(b.label, 12).map((l) => l.length))));
  const labFs = Math.max(11.5, Math.min(18, slot / (widestLabel * 0.54)));

  /* The bar note used to be drawn at a FIXED offset under the axis, on the
     assumption that a bar label is one line. A two-line label ("Died on days /
     4 and 8") then ran straight through it, and on the septic-shock poster
     "most severe baseline parameters" sat on top of its own axis labels. Labels
     and notes are now stacked in order and the canvas grows to hold them, so
     nothing below the axis can collide. */
  const NOTE_FS = 13;
  const labelLines = bars.map((b) => wrapLabel(b.label, 12));
  const noteLines = bars.map((b) => (b.note ? wrapLabel(String(b.note), 16) : []));
  const labRows = Math.max(1, ...labelLines.map((l) => l.length));
  const noteRows = Math.max(0, ...noteLines.map((l) => l.length));
  const labelsBottom = plotB + 28 + (labRows - 1) * (labFs + 4);
  const noteTop = labelsBottom + NOTE_FS + 8;
  const H = (noteRows ? noteTop + (noteRows - 1) * (NOTE_FS + 3) : labelsBottom) + 16;

  let out = `<line x1="${(startX - 14).toFixed(1)}" y1="${plotB}" x2="${(startX + groupW + 14).toFixed(1)}" y2="${plotB}" stroke="rgba(43,47,86,.18)" stroke-width="1.5"/>`;
  bars.forEach((b, i) => {
    const cx = startX + bw / 2 + i * (bw + gap);
    const x = cx - bw / 2;
    const y = yAt(b.value);
    const col = chartColor(b.color);
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(plotB - y).toFixed(1)}" rx="9" fill="${col}"/>`;
    out += `<text x="${cx.toFixed(1)}" y="${(y - 15).toFixed(1)}" text-anchor="middle" font-size="26" font-weight="600" fill="${col}" ${SVG_FONT}>`
      + `${escapeHtml(String(b.value))}${unit ? `<tspan font-size="20">${escapeHtml(unit)}</tspan>` : ''}</text>`;
    // Labels are centred under each bar, so a long unbreakable one (e.g.
    // "b2-microglobulin") ran into its neighbours. Shrink the label type until
    // the widest line fits the per-bar slot rather than overlapping.
    labelLines[i].forEach((ln, k) => {
      out += `<text x="${cx.toFixed(1)}" y="${(plotB + 28 + k * (labFs + 4)).toFixed(1)}" text-anchor="middle" font-size="${labFs.toFixed(1)}" fill="#7d7d93" ${SVG_FONT}>${escapeHtml(ln)}</text>`;
    });
    noteLines[i].forEach((ln, k) => {
      out += `<text x="${cx.toFixed(1)}" y="${(noteTop + k * (NOTE_FS + 3)).toFixed(1)}" text-anchor="middle" font-size="${NOTE_FS}" fill="#b3b3c1" ${SVG_FONT}>${escapeHtml(ln)}</text>`;
    });
  });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(chart.title || 'bars')}">${out}</svg>`;
}

/* ---------- grouped before/after bars (one or several metric groups) ---------- */

function groupedBarsSVG(chart, opts = {}) {
  const groups = chart.groups || [{ name: '', unit: chart.unit || '', series: chart.series || [] }];
  const xlabels = chart.xlabels || [];
  // H grew from 262 to 288 to fit a SECOND group-label line (unit / p-value);
  // plotB keeps the same plot geometry, the extra space is all below the axis.
  const kw = widthFactor(opts);
  const W = Math.round(640 * kw), H = 288, plotL = 14, plotR = W - 14, plotT = 42, plotB = 208;
  /* Scale PER GROUP when the groups have their own units, globally when they
     share one. A single scale across CRP in mg/L (189), IL-6 in pg/mL (700) and
     TNF-alpha in pg/mL (19) squashed the TNF pair into two hairlines: bars that
     cannot be compared anyway, because the units differ, were being forced onto
     one axis. Every bar carries its printed value, so nothing is lost. */
  const units = groups.map((g) => (g.unit || '').trim());
  const oneUnit = units.every((u) => u === units[0]);
  const maxOf = (gs) => {
    let m = 0;
    gs.forEach((g) => (g.series || []).forEach((s) => (s.points || []).forEach((v) => {
      if (typeof v === 'number' && v > m) m = v;
    })));
    return (m || 1) * 1.2;
  };
  const globalMax = maxOf(groups);
  const yFor = (g) => {
    const m = oneUnit ? globalMax : maxOf([g]);
    return (v) => plotB - (v / m) * (plotB - plotT);
  };

  const groupW = (plotR - plotL) / groups.length;
  let out = `<line x1="${plotL}" y1="${plotB}" x2="${plotR}" y2="${plotB}" stroke="rgba(43,47,86,.18)" stroke-width="1.5"/>`;
  groups.forEach((g, gi) => {
    const gx0 = plotL + groupW * gi;
    const yAt = yFor(g);
    const series = g.series || [];
    const nSeries = Math.max(series.length, 1);
    const inner = groupW * 0.82;
    const gpad = (groupW - inner) / 2;
    // Separate each series (Efferon / Control) into its own sub-cluster with a
    // gap between them, so a metric reads as TWO pairs (0h→72h per group), not
    // four evenly-spaced bars.
    const seriesGap = inner * 0.16;
    const subW = (inner - seriesGap * (nSeries - 1)) / nSeries;
    series.forEach((s, si) => {
      const col = chartColor(s.color);
      const sx0 = gx0 + gpad + si * (subW + seriesGap);
      const pts = s.points || [];
      const nPts = Math.max(pts.length, 1);
      const slot = subW / nPts;
      const bw = Math.min(42 * kw, slot * 0.6);
      pts.forEach((v, pi) => {
        const cx = sx0 + slot * (pi + 0.5);
        const y = yAt(v);
        out += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(plotB - y).toFixed(1)}" rx="6" fill="${col}"/>`;
        out += `<text x="${cx.toFixed(1)}" y="${(y - 9).toFixed(1)}" text-anchor="middle" font-size="16" font-weight="700" fill="${col}" ${SVG_FONT}>${escapeHtml(String(v))}</text>`;
        const xl = xlabels[pi] != null ? xlabels[pi] : '';
        out += `<text x="${cx.toFixed(1)}" y="${(plotB + 20).toFixed(1)}" text-anchor="middle" font-size="14" fill="#7d7d93" ${SVG_FONT}>${svgText(xl)}</text>`;
      });
    });
    // group name + unit centred beneath the cluster
    const gcx = gx0 + groupW / 2;
    /* Group label on TWO lines: the name, then the unit and any per-group note
       (a p-value, say) beneath it. One long line ran into the neighbouring
       group's label and the three names collided into unreadable mush. The font
       also steps down when a cluster is narrow. */
    const fs = groupW && groupW < 150 * kw ? 13 : 15;
    /* When the groups carry DIFFERENT series labels (each group its own p-value)
       the shared legend is suppressed — see legendHTML — so the label has to ride
       under its own group, or the figure loses it entirely. */
    const gnames = groups.map((x) => (x.series || []).map((y) => y && y.name).join('|'));
    const perGroup = !gnames.every((x) => x === gnames[0]);
    const note = [g.unit || '', perGroup ? ((g.series || [])[0] || {}).name || '' : '']
      .filter(Boolean).join(' · ');
    if (g.name) {
      out += `<text x="${gcx.toFixed(1)}" y="${(plotB + 42).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#2b2f56" ${SVG_FONT}>${svgText(g.name)}</text>`;
    }
    if (note) {
      out += `<text x="${gcx.toFixed(1)}" y="${(plotB + (g.name ? 62 : 42)).toFixed(1)}" text-anchor="middle" font-size="${fs - 2}" fill="#7d7d93" ${SVG_FONT}>${svgText(note)}</text>`;
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(chart.title || 'grouped bars')}">${out}</svg>`;
}

/* ---------- Kaplan–Meier survival (stepped) ---------- */

function kmSVG(chart) {
  const series = chart.series || [];
  const xmax = chart.xmax || 15;
  // Faithful reproduction of a published KM figure: the y-axis may be a ZOOMED
  // survival window (e.g. 0.4–1.0 in the source) rather than a forced 0–100, and
  // it may carry a dashed vertical guide at a key day (markX + markLabel). Points
  // are still survival % (0–100); ymin/ymax + yticks control what is shown.
  const ymin = (typeof chart.ymin === 'number') ? chart.ymin : 0;
  const ymax = (typeof chart.ymax === 'number') ? chart.ymax : 100;
  const yticks = (chart.yticks && chart.yticks.length)
    ? chart.yticks
    : [0, 25, 50, 75, 100].map((v) => ({ v, label: String(v) }));
  // symmetric left/right gutters so the plot box sits CENTRED in the card. The
  // left gutter is wide enough for BOTH the rotated y-axis title and the tick
  // labels without them overlapping (they collided in a narrow gutter).
  const W = 470, H = 250, plotL = 58, plotR = W - 58, plotT = 16, plotB = H - 44;
  const xAt = (x) => plotL + (x / xmax) * (plotR - plotL);
  const yAt = (y) => plotB - ((y - ymin) / (ymax - ymin)) * (plotB - plotT);

  let grid = '';
  yticks.forEach((t) => {
    const yy = yAt(t.v).toFixed(1);
    grid += `<line x1="${plotL}" y1="${yy}" x2="${plotR}" y2="${yy}" stroke="rgba(43,47,86,.09)" stroke-width="1.2"/>`;
    grid += `<text x="${plotL - 10}" y="${(yAt(t.v) + 5).toFixed(1)}" text-anchor="end" font-size="14" fill="#7d7d93" ${SVG_FONT}>${escapeHtml(t.label)}</text>`;
  });
  // x ticks 0,5,10,15
  let xt = '';
  for (let d = 0; d <= xmax; d += 5) {
    xt += `<text x="${xAt(d).toFixed(1)}" y="${(plotB + 22).toFixed(1)}" text-anchor="middle" font-size="14" fill="#7d7d93" ${SVG_FONT}>${d}</text>`;
  }

  // optional dashed vertical guide (e.g. "day-3 mortality"), drawn UNDER the curves
  let mark = '';
  if (typeof chart.markX === 'number') {
    const mx = xAt(chart.markX).toFixed(1);
    mark += `<line x1="${mx}" y1="${plotT}" x2="${mx}" y2="${plotB}" stroke="rgba(43,47,86,.4)" stroke-width="1.2" stroke-dasharray="4 4"/>`;
    // label sits in the free gap between the two arms (right of the guide), so it
    // never collides with the survival annotations near the top.
    if (chart.markLabel) mark += `<text x="${(xAt(chart.markX) + 7).toFixed(1)}" y="${(yAt((ymin + ymax) / 2 + (ymax - ymin) * 0.24)).toFixed(1)}" font-size="12.5" font-weight="500" fill="#7d7d93" ${SVG_FONT}>${escapeHtml(chart.markLabel)}</text>`;
  }

  let lines = '', annots = '';
  series.forEach((s) => {
    const col = chartColor(s.color);
    const pts = (s.points || []).map((p) => [xAt(p[0]), yAt(p[1])]);
    if (pts.length) {
      // step-after path: hold the level, then step to the next
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) d += ` L${pts[i][0].toFixed(1)} ${pts[i - 1][1].toFixed(1)} L${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
      lines += `<path d="${d}" fill="none" stroke="${col}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    if (s.annot) {
      const ax = xAt(s.annot.x), ay = yAt(s.annot.y);
      annots += `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="4.5" fill="#fff" stroke="${col}" stroke-width="3"/>`;
      annots += `<text x="${(ax + 9).toFixed(1)}" y="${(ay - 8).toFixed(1)}" font-size="14" font-weight="700" fill="${col}" ${SVG_FONT}>${escapeHtml(s.annot.text)}</text>`;
    }
  });

  const axis = `<line x1="${plotL}" y1="${plotB}" x2="${plotR}" y2="${plotB}" stroke="rgba(43,47,86,.22)" stroke-width="1.5"/>`
    + `<line x1="${plotL}" y1="${plotT}" x2="${plotL}" y2="${plotB}" stroke="rgba(43,47,86,.22)" stroke-width="1.5"/>`;
  const xcap = `<text x="${((plotL + plotR) / 2).toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle" font-size="14" fill="#7d7d93" ${SVG_FONT}>${escapeHtml(chart.xlabel || 'Time, days')}</text>`;
  const ycap = `<text x="16" y="${((plotT + plotB) / 2).toFixed(1)}" text-anchor="middle" font-size="13" fill="#7d7d93" ${SVG_FONT} transform="rotate(-90 16 ${((plotT + plotB) / 2).toFixed(1)})">${escapeHtml(chart.ylabel || 'Survival, %')}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(chart.title || 'survival curve')}">`
    + grid + mark + axis + lines + annots + xt + xcap + ycap + `</svg>`;
}

/* ================= drugs strip ================= */

// Render a "remaining" panel (e.g. "Drugs administered") as a slim, wide, low
// horizontal band — heading + body on the left, name chips on the right — so it
// reads lighter/shorter than the leading study-design block above it.
function drugStrip(panel) {
  const heading = panel.heading ? `<div class="ds-k">${richText(panel.heading)}</div>` : '';
  const body = panel.body ? `<p class="ds-text">${richText(panel.body)}</p>` : '';
  const chips = (panel.chips && panel.chips.length)
    ? `<div class="ds-chips">${panel.chips.map((c) => `<span class="pill-drug">${richText(c)}</span>`).join('')}</div>`
    : '';
  return `<div class="drug-strip"><div class="ds-main">${heading}${body}</div>${chips}</div>`;
}

/**
 * The provenance line that opens every poster: journal, authors, device, DOI —
 * small and grey, above the title. It replaced the old footer citation so the
 * reader can place the paper before reading the findings instead of after.
 *
 * Source of truth is `spec.meta`; a spec saved before that field existed falls
 * back to its one-line `citation`, so nothing renders blank.
 */
function metaLine(poster) {
  const m = poster.meta || {};
  const bits = [m.journal, m.authors, m.device, m.doi ? `DOI: ${m.doi}` : '']
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean);
  const text = bits.length ? bits.join('  ·  ') : (poster.citation || '');
  return text ? `<div class="p-meta">${escapeHtml(text)}</div>` : '';
}

/**
 * The one fixed "specifics" slot: everything between the objective and the
 * results — measurements, drugs, sorbent classes, participating hospitals.
 *
 * It used to be two different blocks (`.drugs` and `.hospitals`, sometimes side
 * by side, sometimes stacked), which is why this band looked different on every
 * poster. Now there is exactly ONE band in exactly one position; only the number
 * of columns inside it changes with how much content the paper has.
 */
function specificsHTML(panels, hospitals) {
  const cols = panels.map((p) => {
    const heading = p.heading ? `<div class="sp-k">${richText(p.heading)}</div>` : '';
    const body = p.body ? `<p class="sp-text">${richText(p.body)}</p>` : '';
    const chips = (p.chips && p.chips.length)
      ? `<div class="sp-chips">${p.chips.map((c) => `<span class="pill-drug">${richText(c)}</span>`).join('')}</div>`
      : '';
    return `<div class="sp-col">${heading}${body}${chips}</div>`;
  });

  if (hospitals && hospitals.items && hospitals.items.length) {
    cols.push(`<div class="sp-col">` +
      `<div class="sp-k">${richText(hospitals.heading || 'Participating hospitals')}</div>` +
      `<ul class="sp-list">${hospitals.items.map((h) => `<li>${richText(h)}</li>`).join('')}</ul></div>`);
  }

  if (!cols.length) return '';
  return `<div class="specifics c${Math.min(cols.length, 3)}">${cols.join('')}</div>`;
}

/* ================= descriptive template (reviews) ================= */

/**
 * A review's poster: provenance, title, the ONE sentence that is the paper's
 * point, a rule, the running text, and the paper's own vocabulary.
 *
 * Why a separate template rather than the study one with empty slots: the study
 * layout asks for a lede, a scope panel, an objective banner, a specifics band
 * and a conclusion, and a review abstract is three to five sentences. There is
 * nothing to put in six slots, so every sentence came out written two or three
 * times. Here each sentence lands in exactly one slot.
 */
function descriptiveHTML(poster) {
  const header = poster.header || {};
  const eyebrow = header.kicker ? `<div class="eyebrow">${richText(header.kicker)}</div>` : '';
  const headEl = `<header class="head">
    <div>${eyebrow}<h1 class="p-title">${titleHTML(header)}</h1></div>
    <div class="logo"><img src="${LOGO_SRC}" alt="Efferon"></div>
  </header>`;

  const thesis = poster.thesis ? `<div class="d-thesis">${richText(poster.thesis)}</div>` : '';
  const paras = (poster.body || []).filter(Boolean);
  const body = paras.length
    ? `<div class="d-rule"></div><div class="d-body">${paras.map((p) => `<p>${richText(p)}</p>`).join('')}</div>`
    : '';

  const topics = poster.topics;
  const topicsEl = (topics && topics.items && topics.items.length)
    ? `<div class="d-topics"><div class="d-tk">${richText(topics.label || 'What the review covers')}</div>` +
      `<div class="d-chips">${topics.items.map((t) => `<span>${richText(t)}</span>`).join('')}</div></div>`
    : '';

  // Optional decorative band, full-bleed at the foot. It is never data: it fills
  // leftover height on a very short review instead of leaving white.
  const illo = poster.illustration
    ? `<div class="d-illo"><img src="${encodeURI(poster.illustration)}" alt=""></div>`
    : '';

  return metaLine(poster) + headEl + thesis + body + topicsEl + illo;
}

/* ================= full poster ================= */

/** posterHTML(spec) → the full poster as an HTML string, per spec.template. */
export function posterHTML(spec) {
  const poster = spec || {};
  if (poster.template === 'descriptive') return descriptiveHTML(poster);
  const header = poster.header || {};

  // 0. Provenance, first and quiet — journal / authors / device / DOI.
  const metaEl = metaLine(poster);

  // 1. Header — kicker + big title (coral emphasis pill) + colour logo.
  const eyebrow = header.kicker ? `<div class="eyebrow">${richText(header.kicker)}</div>` : '';
  const title = `<h1 class="p-title">${titleHTML(header)}</h1>`;
  const headEl = `<header class="head">
    <div>${eyebrow}${title}</div>
    <div class="logo"><img src="${LOGO_SRC}" alt="Efferon"></div>
  </header>`;

  // 2. Intro / problem — one full-width lead line (emphasis tokens render).
  const intro = poster.intro
    ? `<div class="intro"><p>${richText(poster.intro)}</p></div>`
    : '';

  // 3. Study design + objective, together and first. First panel (blue) on the
  //    left; objective banner (the one gradient accent) on the right. If the
  //    banner is empty the study panel takes the full width.
  const panels = poster.panels || [];
  const studyPanel = panels[0];
  const restPanels = panels.slice(1);

  const bannerText = (poster.banner && poster.banner.text) ? poster.banner.text : '';
  const objEl = bannerText
    ? `<div class="lead-side"><div class="obj grad"><div class="obj-k">Objective</div>` +
      `<p class="obj-t">${richText(bannerText)}</p></div></div>`
    : '';
  const leadMain = studyPanel ? `<div class="lead-main">${renderPanel(studyPanel, poster)}</div>` : '';
  const leadRow = (leadMain || objEl)
    ? `<div class="lead-row${objEl ? '' : ' full'}">${leadMain}${objEl}</div>`
    : '';

  // 4. The specifics band — one fixed slot, always here, always the same form:
  //    the remaining panels (measurements, drugs, sorbent classes) plus the
  //    participating hospitals as columns inside a single soft-blue band.
  const specificsEl = specificsHTML(restPanels, poster.hospitals);

  // 5. Results — pill + note, then the three chart cards.
  const results = resultsHTML(poster);

  // 6. Conclusion — the dark ink strip at the bottom.
  const conclusion = poster.conclusion
    ? `<div class="conclusion">
        <div class="cpill">Conclusion</div>
        <p class="ctext">${richText(poster.conclusion)}</p>
        <div class="microbe"><img src="${MICROBE_SRC}" alt=""></div>
      </div>`
    : '';

  // Fixed order, every poster: provenance, title, lede, scope + objective,
  // specifics, results, conclusion. The provenance used to be repeated as a
  // footer under the conclusion; it now appears once, at the top.
  return metaEl + headEl + intro + leadRow + specificsEl + results + conclusion;
}

/**
 * renderPoster(spec) → an HTMLElement (`div.poster`), 1400px wide, height free.
 *
 * Only the WIDTH is pinned here. Do NOT set an inline height: it would beat the
 * `min-height` in poster.css and re-introduce the bug this replaced — a
 * number-heavy study overflowed the 990px canvas and lost its conclusion off
 * the bottom edge, while a descriptive one left a third of the page blank.
 * Callers that need the pixel height (stage fit, PNG/PDF export) must MEASURE
 * the element after it is in the document.
 */
export function renderPoster(spec) {
  const d = document.createElement('div');
  // The canvas comes from the template (poster-model.TEMPLATE_CANVAS): a study
  // needs 1400 for its results row; a review gets a narrower sheet with the type
  // scaled up, because 400 characters held at 1400 can only read as stretched.
  const { width, scale } = posterCanvas(spec);
  d.className = 'poster' + (spec && spec.template === 'descriptive' ? ' descriptive' : '');
  // Inline width, not CSS: this is the value the stage and the exporter measure,
  // and an inline rule here has beaten the stylesheet before (see the height bug).
  d.style.width = width + 'px';
  if (scale !== 1) d.style.setProperty('--s', String(scale));
  d.innerHTML = posterHTML(spec);
  return d;
}
