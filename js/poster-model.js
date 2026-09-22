// poster-model.js — Efferon Carousel Studio: Poster Spec (the second output type).
// A single A4-landscape (1400×990) infographic poster in the "P2 · airier"
// language (panels on white). Isolated from the carousel's deck-* engine — this
// module never imports or mutates deck-model.js.

export const POSTER_DIMS = [1400, 990];

/**
 * Canvas width per template. A study poster carries a results row and charts and
 * needs the full 1400; a review carries 380 to 900 characters of prose, and held
 * at 1400 it can only look stretched, so it gets a narrower sheet with the type
 * scaled up to match. Height is content-driven in both cases.
 */
export const TEMPLATE_CANVAS = {
  study:       { width: 1400, scale: 1 },
  descriptive: { width: 1000, scale: 1.18 },
};

/** @returns {{width:number, scale:number}} the canvas for this spec's template. */
export function posterCanvas(spec) {
  return TEMPLATE_CANVAS[(spec && spec.template) || 'study'] || TEMPLATE_CANVAS.study;
}

let _pid = 0;
function nextSectionId() { _pid += 1; return 'sec-' + _pid; }

/** @returns {object} an empty Poster Spec with sane defaults. */
export function newPoster() {
  return {
    format: 'poster-landscape',
    // Which of the two layouts renders this spec. 'study' = the numeric template
    // (scope + objective, specifics band, results row, conclusion). 'descriptive'
    // = a review: one thesis, the running text, the paper's vocabulary. A review
    // pushed through the study template had to restate its three sentences across
    // six slots, which is why the two are separate templates rather than one.
    template: 'study',           // 'study' | 'descriptive'
    kind: '',                    // small section/badge label, e.g. "Clinical study"
    accent: 'coral',
    bodyScale: 1,
    // Provenance, printed small and grey as the poster's FIRST line (see
    // metaLine() in poster-render.js). Four fields rather than one sentence so
    // the renderer owns the order and the separators.
    meta: { journal: '', authors: '', device: '', doi: '' },
    header: { title: '', titleEmphasis: '', kicker: '' },
    intro: '',                   // the problem / lede (emphasis tokens allowed)
    panels: [],                  // [{ id, tone:'blue'|'soft', heading, body, chips:[], stats:[{value,label}] }]
    hospitals: null,             // optional { heading, items:[] } — a small numbered/bulleted institutions panel
    banner: null,                // optional { text } — one restrained gradient accent
    results: { note: '', columns: 3, metrics: [] }, // metrics: [{ value, label, sub }]; columns = results-grid width
    charts: [],                  // [{ id, type, title, sub, span, ... }] — see posterChartSVG() for the per-type shapes
    conclusion: '',
    /* ---- descriptive template only (empty on a study poster) ---- */
    thesis: '',                  // the ONE sentence that is the paper's point
    body: [],                    // the remaining sentences, each used exactly once
    topics: null,                // { label, items:[] } — the paper's own vocabulary
    illustration: '',            // optional decorative asset path, never data
    // Publication provenance, rendered as a thin footer line. Added because a
    // content check across the first real batch found this dropped on EVERY
    // poster — the template simply had nowhere to put it. Distributors need it
    // to be able to find the paper the poster summarises.
    citation: '',              // e.g. 'Shock. 2023;59(6):846-854 · DOI 10.1097/SHK.0000000000002121 · NCT04827407'
    assets: { productPhoto: false, images: [] },
  };
}

/** Adds a panel with an id; returns it. */
export function addPanel(poster, panel) {
  const p = { id: nextSectionId(), tone: 'soft', heading: '', body: '', chips: [], stats: [], ...panel };
  poster.panels.push(p);
  return p;
}

/**
 * @returns {object} a fully-populated demo poster — the antibiotic-clearance
 * study — so the poster view has real content before any AI call.
 */
export function demoPoster() {
  const p = newPoster();
  p.kind = 'Clinical study';
  p.accent = 'coral';
  p.header = {
    title: 'Clearance of Antibacterial Drugs During Hemoadsorption in Patients with Sepsis',
    titleEmphasis: 'Hemoadsorption',
    kicker: 'Multicenter · prospective · observational · Efferon® LPS',
  };
  p.intro = '';   // no invented lede: the source gives no subtitle, so leave it empty
  p.panels = [
    {
      id: nextSectionId(), tone: 'blue',
      heading: 'Study design',
      body: 'A {{blue:multicenter, prospective, observational}} study evaluating the adsorption of three antibiotics during hemoadsorption with Efferon® LPS in critically ill patients.',
      chips: ['All patients had sepsis or septic shock', 'A single 4-hour hemoadsorption using the Efferon® LPS cartridge'],
      stats: [
        { value: '30', label: 'adult patients' },
        { value: '8', label: 'hospitals' },
        { value: '4 h', label: 'single procedure' },
      ],
    },
    {
      id: nextSectionId(), tone: 'soft',
      heading: 'Drugs administered',
      body: 'Each antibiotic was infused within {{blue:30 minutes}} before the procedure. Concentrations were measured in plasma at the cartridge inlet and outlet at multiple time points over 4 hours, and the adsorbed fraction of each drug was calculated.',
      chips: ['Vancomycin', 'Meropenem', 'Linezolid', 'inlet vs outlet · 0 · 30 · 90 · 240 min'],
      stats: [],
    },
  ];
  p.banner = { text: 'Primary objective: to measure the {{blue:adsorbed fraction}} of vancomycin, meropenem and linezolid across a single Efferon® LPS procedure.' };
  p.results = {
    // each drug is ONE chart card carrying its hero number (adsorbed %) over its
    // own inlet/outlet curve — no separate metric cards (they are not zipped).
    note: 'The median adsorbed fraction over the 4-hour procedure was {{blue:low}} for all three antibiotics.',
    metrics: [],
  };
  p.charts = [
    {
      id: nextSectionId(), type: 'line', title: 'Vancomycin', sub: 'n = 10',
      value: '5%', unitLabel: 'adsorbed',
      xlabels: ['0', '30', '90', '240'], xlabel: 'time, min', ylabel: '% from initial',
      series: [
        { name: 'inlet', color: 'coral', points: [100, 60, 45, 38] },
        { name: 'outlet', color: 'blue', points: [null, 50, 45, 38] },
      ],
    },
    {
      id: nextSectionId(), type: 'line', title: 'Meropenem', sub: 'n = 23',
      value: '12%', unitLabel: 'adsorbed',
      xlabels: ['0', '30', '90', '240'], xlabel: 'time, min', ylabel: '% from initial',
      series: [
        { name: 'inlet', color: 'coral', points: [100, 63, 48, 29] },
        { name: 'outlet', color: 'blue', points: [null, 25, 31, 20] },
      ],
    },
    {
      id: nextSectionId(), type: 'line', title: 'Linezolid', sub: 'n = 15',
      value: '20%', unitLabel: 'adsorbed',
      xlabels: ['0', '30', '90', '240'], xlabel: 'time, min', ylabel: '% from initial',
      series: [
        { name: 'inlet', color: 'coral', points: [100, 70, 52, 27] },
        { name: 'outlet', color: 'blue', points: [null, 6, 11, 9] },
      ],
    },
  ];
  p.conclusion = 'Adsorption of vancomycin, meropenem and linezolid during Efferon® LPS hemoadsorption was low across the full 4-hour procedure, indicating that standard antibiotic dosing is likely preserved.';
  p.citation = 'Efferon Global Clinical Education Team, 2026 - internal antibiotic-clearance study (30 patients, 8 hospitals)';
  return p;
}

/**
 * @returns {object} the second demo poster — the Gram-negative multicenter
 * sepsis study — which exercises every richer chart primitive: a SOFA-change
 * donut pair, mortality bars, a Kaplan–Meier survival curve, and grouped
 * before/after marker bars. Kept in the same P2 block flow as demoPoster().
 */
export function demoPosterSepsis() {
  const p = newPoster();
  p.kind = 'Clinical study';
  p.accent = 'blue';
  p.header = {
    title: 'Efferon® LPS is effective in Gram-negative sepsis: results of a multicenter study',
    titleEmphasis: 'results of a multicenter study',
    kicker: 'Clinical study · multicenter · Efferon® LPS',
  };
  p.intro = '';   // the study-design panel carries the lede (as in the reference)
  p.panels = [
    {
      id: nextSectionId(), tone: 'blue',
      heading: 'Study design',
      body: '{{blue:39 patients}} in critical condition with Gram-negative sepsis and septic shock, non-randomly allocated (mean SOFA 7–8, multiple organ dysfunction). Groups were comparable in severity; septic shock in 90% of both.',
      chips: [
        'Efferon group (EG): 10 pts · extracorporeal + standard',
        'Control group (CG): 29 pts · standard therapy',
      ],
      stats: [
        { value: '39', label: 'patients' },
        { value: '7–8', label: 'mean SOFA' },
        { value: '5', label: 'hospitals' },
      ],
    },
    {
      id: nextSectionId(), tone: 'soft',
      heading: 'Methods',
      body: 'Selective hemosorption with Efferon® LPS combined with {{blue:continuous veno-venous hemodiafiltration (CVVHDF)}}, started within 12 hours of diagnosis.',
      chips: ['Two consecutive sessions', 'Each session 6–12 hours', 'Second session 24 hours after the first'],
      stats: [],
    },
  ];
  p.hospitals = {
    heading: 'The study included patients from five hospitals',
    items: [
      'City Clinical Hospital No.7, Almaty',
      'Aktobe Medical Center, Aktobe',
      'City Hospital No.2, Shymkent',
      'City Multidisciplinary Hospital, Taraz',
      'Regional Perinatal Center, Kyzylorda',
    ],
  };
  p.banner = { text: 'To evaluate the efficacy of Efferon® LPS combined with standard therapy in patients with {{blue:Gram-negative sepsis and septic shock}}.' };
  p.results = {
    columns: 7,
    note: 'Over 72 hours, organ function recovered, mortality fell and inflammatory markers dropped, in the {{blue:Efferon group}} only.',
    metrics: [],   // no big-number cards — every result is a chart
  };
  p.charts = [
    // 1 · SOFA change at 72 h — a donut per arm (organ-dysfunction dynamics)
    {
      id: nextSectionId(), type: 'donut', span: 1,
      title: 'SOFA · Efferon',
      donuts: [{ value: '−3,4', tone: 'good', fraction: 0.68, caption: 'SOFA fell 3.4 units, organ-function recovery.' }],
    },
    {
      id: nextSectionId(), type: 'donut', span: 1,
      title: 'SOFA · Control',
      donuts: [{ value: '+1,7', tone: 'bad', fraction: 0.34, caption: 'SOFA rose 1.7 units, worsening.' }],
    },
    // 2 · in-hospital mortality — simple vertical bars
    {
      id: nextSectionId(), type: 'bars', span: 1,
      title: 'Mortality', sub: 'in-hospital', unit: '%', max: 100,
      bars: [
        { label: 'Control', value: 66, color: 'coral', note: '19 of 29' },
        { label: 'Efferon', value: 10, color: 'blue', note: '1 of 10' },
      ],
    },
    // 3 · Kaplan–Meier survival — two stepped arms, redrawn ONE-TO-ONE from the
    //     published figure: zoomed y-axis (0.4–1.0), a dashed day-3 guide, and
    //     the Control arm's full staircase (not a smoothed approximation).
    {
      id: nextSectionId(), type: 'km', span: 2,
      title: 'Survival', sub: 'day-3 mortality: EG 10% · CG 35%', xmax: 15,
      xlabel: 'Time, days', ylabel: 'Survival',
      ymin: 35, ymax: 100,
      yticks: [{ v: 40, label: '0.4' }, { v: 60, label: '0.6' }, { v: 80, label: '0.8' }, { v: 100, label: '1.0' }],
      markX: 3, markLabel: 'day-3 mortality',
      series: [
        { name: 'Efferon', color: 'blue',
          points: [[0, 100], [3, 90], [15, 90]],
          annot: { x: 3, y: 90, text: '1/10 (10%)' } },
        { name: 'Control', color: 'coral',
          points: [[0, 100], [0.4, 97], [0.9, 93], [1.3, 90], [1.8, 86], [2.2, 83], [2.6, 79], [3, 72], [3.4, 69], [4, 62], [5.6, 55], [6.4, 52], [7.8, 45], [9.6, 38], [13, 35]],
          annot: { x: 3.4, y: 69, text: '10/29 (35%)' } },
      ],
    },
    // 4 · inflammatory markers at 72 h — grouped before/after bars, two metrics
    {
      id: nextSectionId(), type: 'grouped', span: 2,
      title: 'Inflammatory markers · 72 h', sub: 'reduced only in the Efferon group',
      xlabels: ['0 h', '72 h'],
      groups: [
        {
          name: 'CRP', unit: 'mg/L',
          series: [
            { name: 'Efferon', color: 'blue', points: [258, 176.2] },
            { name: 'Control', color: 'coral', points: [178, 161.6] },
          ],
        },
        {
          name: 'Creatinine', unit: 'µmol/L',
          series: [
            { name: 'Efferon', color: 'blue', points: [298, 185.3] },
            { name: 'Control', color: 'coral', points: [219, 210.7] },
          ],
        },
      ],
    },
  ];
  p.conclusion = 'Selective Efferon® LPS hemosorption in patients with sepsis and septic shock was associated with a {{blue:reduction in organ dysfunction and mortality}}.';
  p.citation = 'Efferon LPS in Gram-negative sepsis - multicenter study, 5 hospitals (Kazakhstan), 39 patients';
  return p;
}

/**
 * @returns {object} the descriptive-template demo — the endotoxin-detection
 * review. Real content, split so every sentence of the abstract lands in exactly
 * one slot, which is the whole point of this template. Loaded by
 * `carousel-studio.html?demo=poster3` so the layout can be seen without a key.
 */
export function demoPosterReview() {
  const p = newPoster();
  p.template = 'descriptive';
  p.kind = 'Review';
  p.accent = 'blue';
  p.meta = {
    journal: 'General Reanimatology. 2017; 13(5):109-120',
    authors: 'Kopitsyna M.N., Morozov A.S., Bessonov I.V., Pisarev V.M.',
    device: 'Review',
    doi: '10.15360/1813-9779-2017-5-109-120',
  };
  p.header = {
    title: 'Methods for detection of bacterial endotoxin in critical care medicine',
    titleEmphasis: 'endotoxin',
    kicker: 'Review · endotoxin detection',
  };
  p.thesis = 'Emphasis is placed on determining endotoxin content as a clinically significant {{blue:biomarker of sepsis}} caused by gram-negative bacteria.';
  p.body = [
    'The review examines methods for detecting bacterial endotoxins in {{blue:aqueous solutions}} and biological fluids.',
    'The advantages and disadvantages of each method are discussed, and comparative characteristics of {{blue:test systems}} currently used in clinical practice are provided.',
  ];
  p.topics = {
    label: 'What the review covers',
    items: ['Aqueous solutions', 'Biological fluids', 'Test systems in clinical practice', 'Critical care medicine'],
  };
  return p;
}
