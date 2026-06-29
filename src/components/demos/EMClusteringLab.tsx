import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Gaussian Mixture Model trained by Expectation–Maximization.
   - Fixed 2D points (three loose blobs of customers).
   - K Gaussians start badly placed; step the algorithm to watch them settle.
   - E-step: each point gets soft responsibilities -> blended color.
   - M-step: each Gaussian moves to the weighted mean & reshapes its cov.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
type Comp = { mx: number; my: number; sxx: number; syy: number; sxy: number; w: number };

const CLUSTER_COLORS = [
  [79, 70, 229],   // indigo
  [14, 165, 233],  // sky
  [16, 185, 129],  // emerald
];
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(rng: () => number) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// three "true" customer blobs in a 10x10 world
function makeData(): Pt[] {
  const rng = mulberry32(42);
  const blobs = [
    { cx: 3, cy: 7, s: 0.8, n: 22 },
    { cx: 7, cy: 7.5, s: 0.7, n: 20 },
    { cx: 5, cy: 3, s: 1.0, n: 24 },
  ];
  const pts: Pt[] = [];
  for (const b of blobs) for (let i = 0; i < b.n; i++) pts.push({ x: b.cx + gauss(rng) * b.s, y: b.cy + gauss(rng) * b.s });
  return pts;
}

function initComps(): Comp[] {
  // deliberately mediocre starting guesses so EM visibly improves
  const starts = [{ x: 4, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }];
  return starts.map((s) => ({ mx: s.x, my: s.y, sxx: 2.5, syy: 2.5, sxy: 0, w: 1 / 3 }));
}

// 2D Gaussian density
function pdf(p: Pt, c: Comp): number {
  const det = c.sxx * c.syy - c.sxy * c.sxy;
  const d = Math.max(det, 1e-6);
  const ix = c.syy / d, iy = c.sxx / d, ixy = -c.sxy / d;
  const dx = p.x - c.mx, dy = p.y - c.my;
  const q = ix * dx * dx + iy * dy * dy + 2 * ixy * dx * dy;
  return Math.exp(-0.5 * q) / (2 * Math.PI * Math.sqrt(d));
}

// eigen-decomposition of a 2x2 symmetric matrix -> ellipse drawing params
function ellipse(c: Comp) {
  const a = c.sxx, b = c.sxy, d = c.syy;
  const tr = a + d, det = a * d - b * b;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  let ang: number;
  if (Math.abs(b) > 1e-9) ang = Math.atan2(l1 - a, b);
  else ang = a >= d ? 0 : Math.PI / 2;
  return { rx: Math.sqrt(Math.max(l1, 1e-6)), ry: Math.sqrt(Math.max(l2, 1e-6)), ang };
}

export default function EMClusteringLab() {
  const data = useMemo(makeData, []);
  const [comps, setComps] = useState<Comp[]>(initComps);
  const [resp, setResp] = useState<number[][] | null>(null); // [n][K]
  const [iter, setIter] = useState(0);
  const [logL, setLogL] = useState<number | null>(null);
  const [phase, setPhase] = useState<'E' | 'M'>('E');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 460, h: 460, scale: 42, ox: 12, oy: 448 });

  const K = comps.length;

  const computeResp = (cs: Comp[]) => {
    const r: number[][] = [];
    let ll = 0;
    for (const p of data) {
      const px = cs.map((c) => c.w * pdf(p, c));
      const s = px.reduce((a, b) => a + b, 0) || 1e-12;
      ll += Math.log(s);
      r.push(px.map((v) => v / s));
    }
    return { r, ll };
  };

  const eStep = () => {
    const { r, ll } = computeResp(comps);
    setResp(r); setLogL(ll); setPhase('M');
  };

  const mStep = () => {
    const r = resp ?? computeResp(comps).r;
    const next: Comp[] = comps.map((_, k) => {
      let nk = 0, mx = 0, my = 0;
      for (let i = 0; i < data.length; i++) { const w = r[i][k]; nk += w; mx += w * data[i].x; my += w * data[i].y; }
      nk = Math.max(nk, 1e-6); mx /= nk; my /= nk;
      let sxx = 0, syy = 0, sxy = 0;
      for (let i = 0; i < data.length; i++) {
        const w = r[i][k], dx = data[i].x - mx, dy = data[i].y - my;
        sxx += w * dx * dx; syy += w * dy * dy; sxy += w * dx * dy;
      }
      const reg = 0.05; // floor keeps covariances from collapsing to a spike
      return { mx, my, sxx: sxx / nk + reg, syy: syy / nk + reg, sxy: sxy / nk, w: nk / data.length };
    });
    setComps(next); setIter((i) => i + 1); setPhase('E');
  };

  // run a full E then M in one click using locally computed responsibilities
  const fullStep = () => {
    const { r, ll } = computeResp(comps);
    setResp(r); setLogL(ll);
    const next: Comp[] = comps.map((_, k) => {
      let nk = 0, mx = 0, my = 0;
      for (let i = 0; i < data.length; i++) { const w = r[i][k]; nk += w; mx += w * data[i].x; my += w * data[i].y; }
      nk = Math.max(nk, 1e-6); mx /= nk; my /= nk;
      let sxx = 0, syy = 0, sxy = 0;
      for (let i = 0; i < data.length; i++) { const w = r[i][k], dx = data[i].x - mx, dy = data[i].y - my; sxx += w * dx * dx; syy += w * dy * dy; sxy += w * dx * dy; }
      return { mx, my, sxx: sxx / nk + 0.05, syy: syy / nk + 0.05, sxy: sxy / nk, w: nk / data.length };
    });
    setComps(next); setIter((i) => i + 1); setPhase('E');
  };

  const reset = () => { setComps(initComps()); setResp(null); setIter(0); setLogL(null); setPhase('E'); };

  const draw = () => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const { w, h, scale, ox, oy } = size.current;
    const px = (x: number) => ox + x * scale;
    const py = (y: number) => oy - y * scale;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = 'rgba(128,128,128,0.16)'; ctx.lineWidth = 1;
    for (let g = 0; g <= 10; g++) {
      ctx.beginPath(); ctx.moveTo(px(g), py(0)); ctx.lineTo(px(g), py(10)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(0), py(g)); ctx.lineTo(px(10), py(g)); ctx.stroke();
    }

    // Gaussian ellipses (1σ and 2σ contours)
    comps.forEach((c, k) => {
      const e = ellipse(c);
      const col = CLUSTER_COLORS[k % CLUSTER_COLORS.length];
      [2, 1].forEach((sd, idx) => {
        ctx.beginPath();
        ctx.ellipse(px(c.mx), py(c.my), e.rx * scale * sd, e.ry * scale * sd, -e.ang, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${idx === 0 ? 0.35 : 0.7})`;
        ctx.lineWidth = 2; ctx.stroke();
        if (idx === 1) { ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.07)`; ctx.fill(); }
      });
    });

    // points, colored by responsibility blend (soft assignment)
    data.forEach((p, i) => {
      let cr = 90, cg = 90, cb = 90;
      if (resp) {
        cr = 0; cg = 0; cb = 0;
        for (let k = 0; k < K; k++) { const col = CLUSTER_COLORS[k % CLUSTER_COLORS.length]; const w = resp[i][k]; cr += w * col[0]; cg += w * col[1]; cb += w * col[2]; }
      }
      ctx.beginPath(); ctx.arc(px(p.x), py(p.y), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
    });

    // means
    comps.forEach((c, k) => {
      const col = CLUSTER_COLORS[k % CLUSTER_COLORS.length];
      ctx.beginPath(); ctx.arc(px(c.mx), py(c.my), 7, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = rgb(col); ctx.stroke();
    });
  };

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const resize = () => {
      const parent = cv.parentElement!;
      const w = Math.min(parent.clientWidth, 460);
      const h = w;
      const dpr = window.devicePixelRatio || 1;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      const ctx = cv.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const margin = 14; const scale = (w - 2 * margin) / 10;
      size.current = { w, h, scale, ox: margin, oy: h - margin };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [comps, resp]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Three blobs of customers, three Gaussians. Run the two steps and watch the clusters lock on.
          </p>

          <div class="flex flex-wrap gap-2">
            <button onClick={eStep} class="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white">E-step</button>
            <button onClick={mStep} class="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white">M-step</button>
            <button onClick={fullStep} class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text">E + M</button>
            <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text">Reset</button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="iteration" value={String(iter)} />
            <Readout label="next step" value={phase === 'E' ? 'E-step' : 'M-step'} />
            <Readout label="log-likelihood" value={logL === null ? '—' : logL.toFixed(1)} />
            <Readout label="components" value={String(K)} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            <p class="mb-1"><strong class="text-text">E-step:</strong> each point shares itself out among the Gaussians (its color shows the mix).</p>
            <p><strong class="text-text">M-step:</strong> each Gaussian moves to the weighted mean of its points and reshapes its ellipse.</p>
          </div>

          <div class="flex flex-wrap gap-3 text-xs text-muted">
            {comps.map((c, k) => (
              <span key={k} class="flex items-center gap-1.5">
                <span class="inline-block h-2.5 w-2.5 rounded-full" style={`background:${rgb(CLUSTER_COLORS[k])}`} />
                {`π${k + 1} = ${c.w.toFixed(2)}`}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
