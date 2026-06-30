import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Lag-compensation lab: a remote player rendered three ways.
   - TRUE: the smooth motion happening on the remote machine.
   - RAW: snap straight to each low-rate snapshot -> choppy teleporting.
   - SMOOTH: render slightly in the past and interpolate between the
     two buffered snapshots (optionally extrapolate when one is late).
   ------------------------------------------------------------------ */

const COLORS = {
  truth: '#10b981',
  raw: '#4f46e5',
  smooth: '#0ea5e9',
  lane: 'rgba(128,128,128,0.25)',
  tick: 'rgba(128,128,128,0.55)',
};

type Snap = { t: number; pos: number };

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export default function RemotePlayerSmoothingLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rate, setRate] = useState(5); // snapshots per second
  const [delay, setDelay] = useState(120); // interpolation delay (ms)
  const [extrap, setExtrap] = useState(false);
  const [ui, setUi] = useState({ interval: 200, buffer: 0 });

  const rateRef = useRef(rate);
  const delayRef = useRef(delay);
  const extrapRef = useRef(extrap);
  const bufRef = useRef<Snap[]>([]);
  const lastSnapRef = useRef(0);
  const startRef = useRef(0);
  const sizeRef = useRef({ w: 480, h: 230 });

  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { delayRef.current = delay; }, [delay]);
  useEffect(() => { extrapRef.current = extrap; }, [extrap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(Math.max(190, w * 0.44));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let raf = 0;
    let uiClock = 0;

    const truePos = (t: number) => 50 + 40 * Math.sin(t / 900) * Math.cos(t / 2300);

    const xpx = (p: number) => {
      const { w } = sizeRef.current;
      const m = 26;
      return m + (p / 100) * (w - 2 * m);
    };

    const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) => {
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillStyle = COLORS.tick;
      ctx.fillText(label, xpx(0), y - 14);
    };

    const frame = (t: number) => {
      if (!startRef.current) { startRef.current = t; lastSnapRef.current = t; }
      const interval = 1000 / rateRef.current;

      // capture snapshots of the true motion at the chosen rate
      while (t - lastSnapRef.current >= interval) {
        lastSnapRef.current += interval;
        bufRef.current.push({ t: lastSnapRef.current, pos: truePos(lastSnapRef.current) });
      }
      if (bufRef.current.length > 40) bufRef.current.splice(0, bufRef.current.length - 40);

      const buf = bufRef.current;
      const trueP = truePos(t);

      // RAW: jump to the most recent snapshot
      const rawP = buf.length ? buf[buf.length - 1].pos : trueP;

      // SMOOTH: render in the past and interpolate
      let smoothP = rawP;
      const renderT = t - delayRef.current;
      if (buf.length >= 2) {
        let i = buf.length - 1;
        while (i > 0 && buf[i].t > renderT) i--;
        const s0 = buf[i];
        const s1 = buf[Math.min(i + 1, buf.length - 1)];
        if (renderT <= buf[buf.length - 1].t && s1.t > s0.t) {
          smoothP = lerp(s0.pos, s1.pos, Math.max(0, Math.min(1, (renderT - s0.t) / (s1.t - s0.t))));
        } else if (extrapRef.current && buf.length >= 2) {
          const a = buf[buf.length - 2], b = buf[buf.length - 1];
          const vel = (b.pos - a.pos) / (b.t - a.t || 1);
          smoothP = b.pos + vel * (renderT - b.t);
        } else {
          smoothP = buf[buf.length - 1].pos;
        }
      }

      // draw
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { w, h } = sizeRef.current;
          ctx.clearRect(0, 0, w, h);
          const yT = h * 0.26, yR = h * 0.56, yS = h * 0.86;
          for (const y of [yT, yR, yS]) {
            ctx.strokeStyle = COLORS.lane; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(xpx(0), y); ctx.lineTo(xpx(100), y); ctx.stroke();
          }
          // snapshot ticks on the true lane
          ctx.strokeStyle = COLORS.tick; ctx.lineWidth = 1;
          for (const s of buf) {
            const x = xpx(s.pos);
            ctx.beginPath(); ctx.moveTo(x, yT - 6); ctx.lineTo(x, yT + 6); ctx.stroke();
          }
          dot(ctx, xpx(trueP), yT, COLORS.truth, 'true motion');
          dot(ctx, xpx(rawP), yR, COLORS.raw, 'raw (snap-to-latest)');
          dot(ctx, xpx(smoothP), yS, COLORS.smooth, 'smooth (interpolated)');
        }
      }

      if (t - uiClock > 120) {
        uiClock = t;
        setUi({ interval: Math.round(interval), buffer: buf.length });
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block text-muted">snapshot rate: {rate}/s ({ui.interval} ms apart)</span>
          <input type="range" min={2} max={20} step={1} value={rate}
            onInput={(e) => setRate(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#0ea5e9]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">interpolation delay: {delay} ms</span>
          <input type="range" min={0} max={300} step={10} value={delay}
            onInput={(e) => setDelay(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#0ea5e9]" />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setExtrap((x) => !x)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${extrap ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >
          Extrapolation: {extrap ? 'ON' : 'OFF'}
        </button>
        <span class="text-xs text-muted">buffer holds {ui.buffer} snapshots</span>
      </div>

      <p class="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">
        Lower the snapshot rate and watch the <span style="color:#4f46e5">raw</span> dot teleport while the
        <span style="color:#0ea5e9"> smooth</span> dot glides. Raising the delay buys more samples to interpolate
        between, at the cost of showing the player further in the past.
      </p>
    </div>
  );
}
