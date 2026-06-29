import { useMemo, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Conditional Probability & Bayes — natural-frequency grid.
   - A population of 1,000 people drawn as a 40×25 grid of dots.
   - Sliders set prevalence, test sensitivity and specificity.
   - Dots are colored TP / FP / TN / FN; the demo reports P(disease | +)
     by simply counting the highlighted dots — Bayes without algebra.
   ------------------------------------------------------------------ */

const POP = 1000;
const COLS = 40;
const ROWS = POP / COLS; // 25

const C = {
  tp: '#4f46e5', // sick & positive  (true positive)
  fp: '#0ea5e9', // healthy & positive (false positive)
  fn: '#f59e0b', // sick & negative (false negative)
  healthyNeg: 'rgba(128,128,128,0.25)',
};

export default function BayesGridUpdater() {
  const [prev, setPrev] = useState(1);    // % prevalence
  const [sens, setSens] = useState(90);   // % sensitivity (true positive rate)
  const [spec, setSpec] = useState(91);   // % specificity (true negative rate)

  const stats = useMemo(() => {
    const sick = Math.round(POP * (prev / 100));
    const healthy = POP - sick;
    const tp = Math.round(sick * (sens / 100));
    const fn = sick - tp;
    const tn = Math.round(healthy * (spec / 100));
    const fp = healthy - tn;
    const posTotal = tp + fp;
    const ppv = posTotal > 0 ? tp / posTotal : 0; // P(disease | +)
    return { sick, healthy, tp, fn, tn, fp, posTotal, ppv };
  }, [prev, sens, spec]);

  // Assign each of the 1000 cells a category, grouped so the picture reads cleanly.
  const cells = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < stats.tp; i++) arr.push('tp');
    for (let i = 0; i < stats.fn; i++) arr.push('fn');
    for (let i = 0; i < stats.fp; i++) arr.push('fp');
    while (arr.length < POP) arr.push('tn');
    return arr;
  }, [stats]);

  const colorOf = (cat: string) =>
    cat === 'tp' ? C.tp : cat === 'fp' ? C.fp : cat === 'fn' ? C.fn : C.healthyNeg;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 lg:grid-cols-[1fr,auto] lg:items-start">
        <div>
          <div
            class="grid gap-[2px]"
            style={`grid-template-columns:repeat(${COLS},minmax(0,1fr))`}
          >
            {cells.map((cat, i) => (
              <div
                key={i}
                class="aspect-square rounded-[2px]"
                style={`background:${colorOf(cat)}`}
              />
            ))}
          </div>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span class="flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-sm" style={`background:${C.tp}`} /> sick &amp; tested + (TP)</span>
            <span class="flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-sm" style={`background:${C.fp}`} /> healthy &amp; tested + (FP)</span>
            <span class="flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-sm" style={`background:${C.fn}`} /> sick &amp; tested − (FN)</span>
            <span class="flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-sm" style={`background:#9ca3af`} /> healthy &amp; tested − (TN)</span>
          </div>
        </div>

        <div class="space-y-3 text-sm lg:w-64">
          <Slider label="Prevalence" value={prev} min={0} max={50} step={0.5} unit="%" onChange={setPrev} />
          <Slider label="Sensitivity (TPR)" value={sens} min={50} max={100} step={1} unit="%" onChange={setSens} />
          <Slider label="Specificity (TNR)" value={spec} min={50} max={100} step={1} unit="%" onChange={setSpec} />

          <div class="rounded-lg bg-surface-2 p-3 space-y-1">
            <div class="flex justify-between"><span class="text-muted">tested positive</span><strong class="font-mono">{stats.posTotal}</strong></div>
            <div class="flex justify-between"><span class="text-muted">…and truly sick</span><strong class="font-mono" style={`color:${C.tp}`}>{stats.tp}</strong></div>
            <hr class="my-1 border-border" />
            <div class="flex items-baseline justify-between">
              <span class="text-muted">P(sick | +)</span>
              <strong class="font-mono text-lg" style={`color:${C.tp}`}>{(stats.ppv * 100).toFixed(1)}%</strong>
            </div>
          </div>
          <p class="text-xs text-muted">
            With a rare disease, most positives are <span style={`color:${C.fp}`}>false alarms</span> — even an
            accurate test can leave P(sick | +) surprisingly low.
          </p>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label class="block">
      <span class="mb-1 flex justify-between text-muted">
        <span>{label}</span>
        <span class="font-mono text-text">{value}{unit}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]"
      />
    </label>
  );
}
