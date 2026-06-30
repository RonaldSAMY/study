import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Game-audio playground.
   - Slide FREQUENCY (pitch) and AMPLITUDE (loudness) to reshape a
     live, scrolling sound wave.
   - Slide DISTANCE to hear (see) how a 3D source attenuates with
     range, using an inverse-distance rolloff.
   - Pan readout shows left/right balance from the listener's angle.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  wave: '#4f46e5',
  ghost: 'rgba(79,70,229,0.25)',
  sky: '#0ea5e9',
  result: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const REF_DIST = 2; // metres at which gain is 1.0

export default function WaveAttenuationLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const sizeRef = useRef({ w: 480, h: 240 });

  const [freq, setFreq] = useState(3); // cycles across the view
  const [amp, setAmp] = useState(0.8); // 0..1
  const [dist, setDist] = useState(REF_DIST); // metres
  const [pan, setPan] = useState(0); // -1 (L) .. +1 (R)

  // inverse-distance rolloff, clamped to 1.0 inside the reference radius
  const gain = Math.min(1, REF_DIST / Math.max(REF_DIST, dist));
  const effAmp = amp * gain;

  // keep latest values for the animation loop without restarting it
  const stateRef = useRef({ freq, effAmp });
  stateRef.current = { freq, effAmp };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const mid = h / 2;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += w / 12) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    // centre axis
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

    const { freq: f, effAmp: a } = stateRef.current;
    const maxPix = mid * 0.92;
    const k = (f * 2 * Math.PI) / w;
    const ph = phaseRef.current;

    // ghost wave at full (un-attenuated) amplitude for comparison
    const fullA = Math.min(1, amp);
    ctx.strokeStyle = COLORS.ghost;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const y = mid - Math.sin(k * x + ph) * fullA * maxPix;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // attenuated wave actually reaching the listener
    ctx.strokeStyle = COLORS.wave;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const y = mid - Math.sin(k * x + ph) * a * maxPix;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.5);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- animation loop (scroll the phase) ----
  useEffect(() => {
    const loop = () => {
      phaseRef.current -= 0.06;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const panLabel = pan < -0.05 ? `${Math.round(-pan * 100)}% L` : pan > 0.05 ? `${Math.round(pan * 100)}% R` : 'centre';
  const leftGain = effAmp * Math.cos(((pan + 1) / 2) * (Math.PI / 2));
  const rightGain = effAmp * Math.sin(((pan + 1) / 2) * (Math.PI / 2));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">frequency (pitch) = {freq.toFixed(1)} cycles</span>
            <input type="range" min={1} max={12} step={0.5} value={freq}
              onInput={(e) => setFreq(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">amplitude (loudness) = {amp.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.01} value={amp}
              onInput={(e) => setAmp(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">distance to source = {dist.toFixed(1)} m</span>
            <input type="range" min={REF_DIST} max={40} step={0.5} value={dist}
              onInput={(e) => setDist(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">pan (listener angle) = {panLabel}</span>
            <input type="range" min={-1} max={1} step={0.01} value={pan}
              onInput={(e) => setPan(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="distance gain" value={gain.toFixed(2)} />
            <Readout label="heard amplitude" value={effAmp.toFixed(2)} />
            <Readout label="left channel" value={leftGain.toFixed(2)} />
            <Readout label="right channel" value={rightGain.toFixed(2)} />
          </div>
          <p class="text-xs text-muted">
            The faint wave is the source at full volume; the bold wave is what the listener actually
            hears after distance attenuation.
          </p>
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
