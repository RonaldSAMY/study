import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   VAE latent-space explorer.
   - Left: the 2D latent plane with the prior N(0, I) contours. Drag the
     point z (the encoder's mean for one image).
   - Right: the decoder turns z into an image; it morphs smoothly as you
     drag, because nearby latents decode to similar pictures.
   - The ELBO splits into a reconstruction term (how well z rebuilds the
     target datapoint) and a KL term (how far z drifts from the prior).
   ------------------------------------------------------------------ */

const COLORS = {
  z: '#10b981',
  target: '#f59e0b',
  prior: '#4f46e5',
  grid: 'rgba(128,128,128,0.18)',
};

type Vec = { x: number; y: number };

// fixed "decoder weights" so the generated images are deterministic
const FEAT = Array.from({ length: 6 }, (_, k) => ({
  fx: 1.1 + 0.9 * Math.sin(k * 1.7),
  fy: 1.1 + 0.9 * Math.cos(k * 2.3),
  ph: k * 1.3,
  g1: Math.sin(k * 0.8) * 1.6,
  g2: Math.cos(k * 1.1) * 1.6,
  amp: 0.7 + 0.3 * Math.sin(k),
}));

const TARGET: Vec = { x: 1.1, y: -0.9 }; // the datapoint we are trying to reconstruct
const GRID = 24;

export default function VaeLatentExplorer() {
  const latentRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef(false);
  const sizeRef = useRef({ s: 240, scale: 40, ox: 120, oy: 120 });

  const [z, setZ] = useState<Vec>({ x: 0.6, y: 0.4 });
  const [sigma, setSigma] = useState(0.6);

  const toPx = (p: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  };
  const toMath = (px: number, py: number): Vec => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: (px - ox) / scale, y: (oy - py) / scale };
  };

  const drawLatent = () => {
    const canvas = latentRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { s, ox, oy, scale } = sizeRef.current;
    ctx.clearRect(0, 0, s, s);

    // prior contours
    ctx.strokeStyle = COLORS.prior;
    for (let r = 1; r <= 3; r++) {
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ox, oy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // axes
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(s, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, s); ctx.stroke();

    // target datapoint
    const t = toPx(TARGET);
    ctx.fillStyle = COLORS.target;
    ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('data', t.x + 8, t.y - 6);

    // posterior spread (sigma) around z
    const q = toPx(z);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = COLORS.z;
    ctx.beginPath(); ctx.arc(q.x, q.y, sigma * scale, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // z handle
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.z; ctx.stroke();
  };

  const drawImage = () => {
    const canvas = imgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { s } = sizeRef.current;
    const cell = s / GRID;
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const u = (i / (GRID - 1)) * 2 - 1;
        const v = (j / (GRID - 1)) * 2 - 1;
        let val = 0;
        for (const f of FEAT) {
          val += f.amp * Math.sin(f.fx * u + f.fy * v + f.ph + z.x * f.g1 + z.y * f.g2);
        }
        const t = 1 / (1 + Math.exp(-val)); // squash to [0,1]
        const r = Math.round(40 + t * 60);
        const g = Math.round(60 + t * 150);
        const b = Math.round(90 + t * 120);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(i * cell, j * cell, cell + 1, cell + 1);
      }
    }
  };

  useEffect(() => {
    const lat = latentRef.current;
    const img = imgRef.current;
    if (!lat || !img) return;
    const resize = () => {
      const parent = lat.parentElement!.parentElement!;
      const avail = parent.clientWidth;
      const s = Math.max(150, Math.min(Math.floor((avail - 24) / 2), 230));
      const dpr = window.devicePixelRatio || 1;
      for (const c of [lat, img]) {
        c.width = s * dpr;
        c.height = s * dpr;
        c.style.width = `${s}px`;
        c.style.height = `${s}px`;
        const ctx = c.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      sizeRef.current = { s, scale: s / 7, ox: s / 2, oy: s / 2 };
      drawLatent();
      drawImage();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => { drawLatent(); drawImage(); }, [z, sigma]);

  const pointer = (e: PointerEvent) => {
    const rect = latentRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    dragRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const { px, py } = pointer(e);
    setZ(toMath(px, py));
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    setZ(toMath(px, py));
  };
  const onUp = () => { dragRef.current = false; };

  // ELBO pieces (pedagogical proxies)
  const recon = (z.x - TARGET.x) ** 2 + (z.y - TARGET.y) ** 2;
  const kl = 0.5 * (z.x * z.x + z.y * z.y + 2 * sigma * sigma - 2 - 2 * Math.log(sigma));
  const loss = recon + kl;
  const barMax = 8;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-center gap-3">
        <div class="text-center">
          <canvas
            ref={latentRef}
            class="touch-none rounded-xl bg-surface-2"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          <p class="mt-1 text-xs text-muted">latent plane — drag z</p>
        </div>
        <div class="text-center">
          <canvas ref={imgRef} class="rounded-xl bg-surface-2" />
          <p class="mt-1 text-xs text-muted">decoder output</p>
        </div>
      </div>

      <div class="mt-4 space-y-3 text-sm">
        <label class="block">
          <span class="mb-1 block text-muted">posterior std σ = {sigma.toFixed(2)}</span>
          <input
            type="range" min={0.2} max={1.6} step={0.05} value={sigma}
            onInput={(e) => setSigma(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]"
          />
        </label>

        <Bar label="reconstruction" value={recon} max={barMax} color="#0ea5e9" />
        <Bar label="KL to prior" value={kl} max={barMax} color="#4f46e5" />
        <Bar label="total loss (−ELBO)" value={loss} max={barMax} color="#10b981" />

        <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
          Drag z onto the orange <strong>data</strong> point: reconstruction drops but KL
          climbs (you have wandered from the origin). Drag z to the center: KL vanishes but
          the reconstruction suffers. Training balances the two — that tug-of-war is the ELBO.
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div class="mb-1 flex justify-between text-xs">
        <span class="text-muted">{label}</span>
        <span class="font-mono font-semibold">{value.toFixed(2)}</span>
      </div>
      <div class="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div class="h-full rounded-full" style={`width:${pct}%;background:${color}`} />
      </div>
    </div>
  );
}
