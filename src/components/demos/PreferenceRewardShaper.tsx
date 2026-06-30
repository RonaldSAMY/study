import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   RLHF preference -> reward model -> aligned output distribution.
   - Four candidate LLM replies, each scored on three traits.
   - The preference sliders ARE the reward model's weights: a reply's
     reward is the weighted sum of its traits, r = w · features.
   - The aligned policy is a softmax over rewards, π ∝ exp(β·r); the
     bars show how the LLM's output probabilities shift as you tune
     what humans prefer. No canvas needed — pure reactive bars.
   ------------------------------------------------------------------ */

type Reply = { text: string; helpful: number; concise: number; warm: number };

const REPLIES: Reply[] = [
  { text: '"Here\'s a clear step-by-step fix, plus why it works."', helpful: 0.95, concise: 0.45, warm: 0.7 },
  { text: '"Just do X."', helpful: 0.5, concise: 0.98, warm: 0.25 },
  { text: '"Oh wonderful question! Let me lovingly walk you through every detail..."', helpful: 0.7, concise: 0.15, warm: 0.98 },
  { text: '"That\'s obvious, figure it out yourself."', helpful: 0.15, concise: 0.8, warm: 0.05 },
];

const BAR = ['#4f46e5', '#0ea5e9', '#10b981', '#ef4444'];

export default function PreferenceRewardShaper() {
  const [wHelp, setWHelp] = useState(1);
  const [wConcise, setWConcise] = useState(0.4);
  const [wWarm, setWWarm] = useState(0.3);
  const [beta, setBeta] = useState(4);

  const rewards = REPLIES.map((r) => wHelp * r.helpful + wConcise * r.concise + wWarm * r.warm);
  const exps = rewards.map((r) => Math.exp(beta * r));
  const Z = exps.reduce((a, b) => a + b, 0) || 1;
  const probs = exps.map((e) => e / Z);
  const best = probs.indexOf(Math.max(...probs));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <div class="space-y-3">
          <p class="text-sm text-muted">
            The LLM's chosen reply (highest bar) shifts as you change what humans reward.
          </p>
          {REPLIES.map((reply, i) => (
            <div key={i} class="rounded-lg bg-surface-2 p-3">
              <div class="mb-1.5 flex items-start justify-between gap-2">
                <span class={`text-sm ${i === best ? 'font-semibold text-text' : 'text-muted'}`}>{reply.text}</span>
                <span class="shrink-0 font-mono text-xs text-muted">r={rewards[i].toFixed(2)}</span>
              </div>
              <div class="h-3 w-full overflow-hidden rounded-full bg-border">
                <div
                  class="h-full rounded-full transition-all"
                  style={`width:${(probs[i] * 100).toFixed(1)}%;background:${BAR[i]}`}
                />
              </div>
              <div class="mt-1 text-right font-mono text-xs text-muted">π = {(probs[i] * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>

        <div class="space-y-3 text-sm md:w-56">
          <p class="text-muted">Preference weights (the reward model):</p>
          <Slider label="reward helpfulness" color="#4f46e5" value={wHelp} set={setWHelp} />
          <Slider label="reward conciseness" color="#0ea5e9" value={wConcise} set={setWConcise} />
          <Slider label="reward warmth" color="#10b981" value={wWarm} set={setWWarm} />
          <label class="block">
            <span class="mb-1 block text-muted">alignment strength β = {beta.toFixed(1)}</span>
            <input type="range" min={0} max={10} step={0.5} value={beta}
              onInput={(e) => setBeta(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            β = 0 → ignore the reward (random). Large β → almost always pick the top-rewarded reply.
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, color, value, set }: { label: string; color: string; value: number; set: (v: number) => void }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label} = {value.toFixed(2)}</span>
      <input type="range" min={-1} max={2} step={0.05} value={value}
        onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full" style={`accent-color:${color}`} />
    </label>
  );
}
