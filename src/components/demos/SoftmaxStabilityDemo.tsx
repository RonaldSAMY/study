import { useMemo, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Naive vs numerically-stable softmax.
   - A "scale" slider multiplies four base logits. Push it up and the
     naive exp(x) overflows to Infinity (probabilities become NaN),
     while the stable version (subtract the max first) stays correct.
   ------------------------------------------------------------------ */

const BASE = [2, 1, 0.5, -1];
const COLORS = { ok: '#10b981', bad: '#f43f5e', bar: '#4f46e5' };

function softmaxNaive(x: number[]) {
  const ex = x.map((v) => Math.exp(v));
  const sum = ex.reduce((s, v) => s + v, 0);
  return ex.map((v) => v / sum); // Infinity/Infinity = NaN when overflowing
}

function softmaxStable(x: number[]) {
  const m = Math.max(...x);
  const ex = x.map((v) => Math.exp(v - m));
  const sum = ex.reduce((s, v) => s + v, 0);
  return ex.map((v) => v / sum);
}

const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : v > 0 ? '∞' : 'NaN');

export default function SoftmaxStabilityDemo() {
  const [scale, setScale] = useState(1);

  const logits = useMemo(() => BASE.map((v) => v * scale), [scale]);
  const naive = useMemo(() => softmaxNaive(logits), [logits]);
  const stable = useMemo(() => softmaxStable(logits), [logits]);
  const naiveBroken = naive.some((p) => !Number.isFinite(p));
  const maxExp = Math.max(...logits);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <label class="block text-sm">
        <span class="mb-1 block text-muted">
          scale = {scale} → logits = [{logits.map((v) => v.toFixed(1)).join(', ')}]
        </span>
        <input
          type="range"
          min={1}
          max={400}
          step={1}
          value={scale}
          onInput={(e) => setScale(parseInt((e.target as HTMLInputElement).value, 10))}
          class="w-full accent-[#4f46e5]"
        />
      </label>
      <p class="mt-1 text-xs text-muted">
        Largest term is exp({maxExp.toFixed(0)}) — float64 overflows past exp(709) ≈ 1.8 × 10³⁰⁸.
      </p>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        {/* naive */}
        <div class="rounded-xl bg-surface-2 p-3">
          <div class="mb-2 flex items-center gap-2 text-sm font-semibold" style={`color:${naiveBroken ? COLORS.bad : COLORS.ok}`}>
            <span>{naiveBroken ? '✗' : '✓'}</span> naive softmax
          </div>
          {naive.map((p, idx) => (
            <div key={idx} class="mb-1.5">
              <div class="flex justify-between font-mono text-xs">
                <span class="text-muted">class {idx}</span>
                <span style={naiveBroken ? `color:${COLORS.bad}` : ''}>{fmt(p)}</span>
              </div>
              <div class="h-2 overflow-hidden rounded bg-surface">
                <div
                  class="h-full rounded"
                  style={`width:${Number.isFinite(p) ? Math.max(0, p) * 100 : 0}%;background:${COLORS.bar}`}
                />
              </div>
            </div>
          ))}
          {naiveBroken && <p class="mt-1 text-xs" style={`color:${COLORS.bad}`}>exp overflowed → ∞/∞ = NaN.</p>}
        </div>

        {/* stable */}
        <div class="rounded-xl bg-surface-2 p-3">
          <div class="mb-2 flex items-center gap-2 text-sm font-semibold" style={`color:${COLORS.ok}`}>
            <span>✓</span> stable softmax (− max)
          </div>
          {stable.map((p, idx) => (
            <div key={idx} class="mb-1.5">
              <div class="flex justify-between font-mono text-xs">
                <span class="text-muted">class {idx}</span>
                <span>{fmt(p)}</span>
              </div>
              <div class="h-2 overflow-hidden rounded bg-surface">
                <div class="h-full rounded" style={`width:${p * 100}%;background:${COLORS.ok}`} />
              </div>
            </div>
          ))}
          <p class="mt-1 text-xs text-muted">Subtracting the max keeps every exp in [0, 1].</p>
        </div>
      </div>
    </div>
  );
}
