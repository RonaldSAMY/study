import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   The Jacobian as a local linear map (robot-arm kinematics).
   Input  = two joint angles (θ1, θ2).
   Output = the hand position (x, y) of a 2-segment arm.
   A small circle of "joint wiggles" in input space maps to an
   ellipse of hand positions — that ellipse IS the Jacobian acting.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };
const L1 = 1.2;
const L2 = 1.0;

// forward kinematics: angles -> hand position
function fk(t1: number, t2: number): Vec {
  return {
    x: L1 * Math.cos(t1) + L2 * Math.cos(t1 + t2),
    y: L1 * Math.sin(t1) + L2 * Math.sin(t1 + t2),
  };
}
function elbow(t1: number): Vec {
  return { x: L1 * Math.cos(t1), y: L1 * Math.sin(t1) };
}

// analytic Jacobian
function jacobian(t1: number, t2: number) {
  return {
    a: -L1 * Math.sin(t1) - L2 * Math.sin(t1 + t2), // dx/dθ1
    b: -L2 * Math.sin(t1 + t2), // dx/dθ2
    c: L1 * Math.cos(t1) + L2 * Math.cos(t1 + t2), // dy/dθ1
    d: L2 * Math.cos(t1 + t2), // dy/dθ2
  };
}

const PI = Math.PI;

export default function JacobianPropagator() {
  const inRef = useRef<HTMLCanvasElement>(null);
  const outRef = useRef<HTMLCanvasElement>(null);
  const inSize = useRef({ w: 300, h: 300 });
  const outSize = useRef({ w: 300, h: 300 });
  const [ang, setAng] = useState<Vec>({ x: 0.7, y: 0.9 }); // (θ1, θ2)
  const [r, setR] = useState(0.35); // wiggle radius (radians)
  const dragRef = useRef(false);

  // input space mapping: θ ∈ [-π, π]
  const inToPx = (t: Vec) => {
    const { w, h } = inSize.current;
    return { x: ((t.x + PI) / (2 * PI)) * w, y: ((PI - t.y) / (2 * PI)) * h };
  };
  const inToMath = (px: number, py: number): Vec => {
    const { w, h } = inSize.current;
    return { x: (px / w) * 2 * PI - PI, y: PI - (py / h) * 2 * PI };
  };
  // output space mapping: x,y ∈ [-2.6, 2.6]
  const R = 2.6;
  const outToPx = (v: Vec) => {
    const { w, h } = outSize.current;
    return { x: ((v.x + R) / (2 * R)) * w, y: ((R - v.y) / (2 * R)) * h };
  };

  const drawInput = () => {
    const canvas = inRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = inSize.current;
    ctx.clearRect(0, 0, w, h);
    // grid
    ctx.strokeStyle = 'rgba(128,128,128,0.18)'; ctx.lineWidth = 1;
    for (let g = -PI; g <= PI + 0.01; g += PI / 2) {
      const p = inToPx({ x: g, y: 0 });
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
      const q = inToPx({ x: 0, y: g });
      ctx.beginPath(); ctx.moveTo(0, q.y); ctx.lineTo(w, q.y); ctx.stroke();
    }
    // perturbation circle
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * 2 * PI;
      const p = inToPx({ x: ang.x + r * Math.cos(a), y: ang.y + r * Math.sin(a) });
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    // center handle
    const c = inToPx(ang);
    ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, 2 * PI);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#4f46e5'; ctx.stroke();
    ctx.fillStyle = 'rgba(128,128,128,0.9)'; ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('θ1 →', w - 38, h - 8);
    ctx.fillText('θ2 ↑', 6, 14);
  };

  const drawOutput = () => {
    const canvas = outRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = outSize.current;
    ctx.clearRect(0, 0, w, h);
    // axes
    ctx.strokeStyle = 'rgba(128,128,128,0.3)'; ctx.lineWidth = 1;
    const o = outToPx({ x: 0, y: 0 });
    ctx.beginPath(); ctx.moveTo(0, o.y); ctx.lineTo(w, o.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x, 0); ctx.lineTo(o.x, h); ctx.stroke();
    // mapped blob (image of the wiggle circle)
    ctx.fillStyle = 'rgba(14,165,233,0.18)';
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * 2 * PI;
      const hand = fk(ang.x + r * Math.cos(a), ang.y + r * Math.sin(a));
      const p = outToPx(hand);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // the arm
    const base = outToPx({ x: 0, y: 0 });
    const elb = outToPx(elbow(ang.x));
    const hand = fk(ang.x, ang.y);
    const hp = outToPx(hand);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(elb.x, elb.y); ctx.stroke();
    ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(elb.x, elb.y); ctx.lineTo(hp.x, hp.y); ctx.stroke();
    // joints
    for (const [pt, col] of [[base, '#334155'], [elb, '#334155'], [hp, '#10b981']] as [Vec, string][]) {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, 2 * PI);
      ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  };

  useEffect(() => {
    const resize = () => {
      const ci = inRef.current, co = outRef.current;
      if (!ci || !co) return;
      const parent = ci.parentElement!.parentElement!;
      const total = Math.min(parent.clientWidth, 620);
      const w = Math.floor((total - 16) / 2);
      const dpr = window.devicePixelRatio || 1;
      for (const [canvas, store] of [[ci, inSize], [co, outSize]] as const) {
        canvas.width = w * dpr; canvas.height = w * dpr;
        canvas.style.width = `${w}px`; canvas.style.height = `${w}px`;
        canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
        store.current = { w, h: w };
      }
      drawInput(); drawOutput();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => { drawInput(); drawOutput(); }, [ang, r]);

  const pointer = (e: PointerEvent) => {
    const rect = inRef.current!.getBoundingClientRect();
    return inToMath(e.clientX - rect.left, e.clientY - rect.top);
  };
  const onDown = (e: PointerEvent) => {
    dragRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setAng(pointer(e)); e.preventDefault();
  };
  const onMove = (e: PointerEvent) => { if (dragRef.current) setAng(pointer(e)); };
  const onUp = () => { dragRef.current = false; };

  const J = jacobian(ang.x, ang.y);
  const det = J.a * J.d - J.b * J.c;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-2 grid gap-2 md:grid-cols-2 md:gap-4">
        <div>
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Input: joint angles</p>
          <canvas ref={inRef} class="touch-none rounded-xl bg-surface-2"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        </div>
        <div>
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Output: hand position</p>
          <canvas ref={outRef} class="touch-none rounded-xl bg-surface-2" />
        </div>
      </div>

      <div class="mt-3 space-y-3 text-sm">
        <label class="block">
          <span class="mb-1 block text-muted">wiggle size = {r.toFixed(2)} rad</span>
          <input type="range" min={0.05} max={0.6} step={0.01} value={r}
            onInput={(e) => setR(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#0ea5e9]" />
        </label>
        <div class="grid gap-2 sm:grid-cols-2">
          <div class="rounded-lg bg-surface-2 p-3">
            <p class="mb-1 text-xs text-muted">Jacobian J (hand-move per joint-wiggle)</p>
            <div class="font-mono text-xs leading-relaxed">
              <div>[ {J.a.toFixed(2)}&nbsp;&nbsp;{J.b.toFixed(2)} ]</div>
              <div>[ {J.c.toFixed(2)}&nbsp;&nbsp;{J.d.toFixed(2)} ]</div>
            </div>
          </div>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">det J (area gain)</span><strong class="font-mono">{det.toFixed(2)}</strong></div>
            <p class="mt-1 text-xs text-muted">
              {Math.abs(det) < 0.15
                ? 'Near zero — the arm is nearly straight; tiny wiggles barely move the hand in one direction (a singular pose).'
                : 'The circle of wiggles becomes an ellipse — the Jacobian stretches and rotates it.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
