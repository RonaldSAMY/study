import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Entity interpolation demo.
   - A remote player glides smoothly along a path (the "truth").
   - The server only sends snapshots a few times per second.
   - RAW (sky): snap straight to the newest snapshot -> jerky teleporting.
   - INTERPOLATED (emerald): render slightly in the past and lerp
     between the two newest snapshots -> buttery smooth.
   - Slide the snapshot rate and the interpolation buffer.
   - rAF loop, cancelled on unmount.
   ------------------------------------------------------------------ */

type Snap = { t: number; x: number; y: number };

const COLORS = {
  truth: 'rgba(128,128,128,0.45)',
  raw: '#0ea5e9',
  interp: '#10b981',
  path: 'rgba(128,128,128,0.18)',
};

export default function EntityInterpolationDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const snapsRef = useRef<Snap[]>([]);
  const lastSnapRef = useRef<number>(0);
  const sizeRef = useRef({ w: 480, h: 320 });

  const [rate, setRate] = useState(8);        // snapshots per second
  const [buffer, setBuffer] = useState(140);  // interpolation delay ms
  const [showTruth, setShowTruth] = useState(true);
  const paramRef = useRef({ rate, buffer, showTruth });
  paramRef.current = { rate, buffer, showTruth };

  const truthAt = (t: number, w: number, h: number) => {
    // a smooth Lissajous path inside the canvas
    const cx = w / 2, cy = h / 2;
    const rx = w * 0.32, ry = h * 0.3;
    const s = t / 1000;
    return { x: cx + rx * Math.cos(s * 1.1), y: cy + ry * Math.sin(s * 1.7) };
  };

  const draw = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const { rate: r, buffer: buf, showTruth: st } = paramRef.current;

    // sample a snapshot at the chosen rate
    if (now - lastSnapRef.current >= 1000 / r) {
      lastSnapRef.current = now;
      const p = truthAt(now, w, h);
      snapsRef.current.push({ t: now, x: p.x, y: p.y });
      if (snapsRef.current.length > 60) snapsRef.current.shift();
    }

    ctx.clearRect(0, 0, w, h);

    // faint full path
    ctx.strokeStyle = COLORS.path; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 80; k++) {
      const p = truthAt(now - (1 - k / 80) * 4000, w, h);
      if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // true position (reference)
    if (st) {
      const p = truthAt(now, w, h);
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.truth; ctx.fill();
    }

    const snaps = snapsRef.current;

    // RAW: hold the newest snapshot
    if (snaps.length) {
      const last = snaps[snaps.length - 1];
      dot(ctx, last.x, last.y, COLORS.raw, 'raw');
      // show snapshot ticks
      ctx.fillStyle = 'rgba(14,165,233,0.5)';
      for (const s of snaps) { ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }

    // INTERPOLATED: render in the past and lerp between two snapshots
    const renderT = now - buf;
    let ix = -1;
    for (let i = 0; i < snaps.length - 1; i++) {
      if (snaps[i].t <= renderT && snaps[i + 1].t >= renderT) { ix = i; break; }
    }
    if (ix >= 0) {
      const a = snaps[ix], b = snaps[ix + 1];
      const f = (renderT - a.t) / (b.t - a.t || 1);
      dot(ctx, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, COLORS.interp, 'interpolated');
    } else if (snaps.length) {
      const a = snaps[0];
      dot(ctx, a.x, a.y, COLORS.interp, 'interpolated');
    }

    rafRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      snapsRef.current = [];
    };
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">snapshot rate = {rate} Hz (every {Math.round(1000 / rate)} ms)</span>
            <input type="range" min={3} max={30} step={1} value={rate}
              onInput={(e) => setRate(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">interpolation buffer = {buffer} ms</span>
            <input type="range" min={0} max={320} step={10} value={buffer}
              onInput={(e) => setBuffer(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <button onClick={() => setShowTruth((v) => !v)}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">
            {showTruth ? 'Hide true position' : 'Show true position'}
          </button>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Lower the snapshot rate and watch the <span style="color:#0ea5e9">raw</span> dot teleport between
            ticks, while the <span style="color:#10b981">interpolated</span> dot stays smooth. Too small a
            buffer and even interpolation stutters; too large and it lags further behind the truth.
          </div>
        </div>
      </div>
    </div>
  );
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) {
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = color; ctx.font = '700 11px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 16);
  ctx.textAlign = 'left';
}
