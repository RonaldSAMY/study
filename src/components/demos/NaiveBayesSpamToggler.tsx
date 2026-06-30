import { useMemo, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive Naive Bayes spam classifier.
   - Toggle which words appear in an email.
   - Each word carries preset P(word | spam) and P(word | ham).
   - Slider sets the prior P(spam).
   - We work in LOG-ODDS for numerical sanity, then convert back to a
     probability, a gauge, and a SPAM / HAM verdict.
   ------------------------------------------------------------------ */

const COLORS = {
  spam: '#4f46e5', // indigo
  ham: '#10b981', // emerald
  accent: '#0ea5e9', // sky
};

type Word = {
  text: string;
  pSpam: number; // P(word | spam)
  pHam: number; // P(word | ham)
};

// Preset likelihoods. Spammy words: high P(word|spam) vs P(word|ham).
// Hammy (work) words: the reverse.
const WORDS: Word[] = [
  { text: 'free', pSpam: 0.6, pHam: 0.12 },
  { text: 'winner', pSpam: 0.5, pHam: 0.04 },
  { text: 'viagra', pSpam: 0.45, pHam: 0.005 },
  { text: 'meeting', pSpam: 0.08, pHam: 0.5 },
  { text: 'invoice', pSpam: 0.1, pHam: 0.4 },
  { text: 'schedule', pSpam: 0.06, pHam: 0.35 },
];

export default function NaiveBayesSpamToggler() {
  const [present, setPresent] = useState<boolean[]>(() => WORDS.map(() => false));
  const [prior, setPrior] = useState(0.3); // P(spam)

  const toggle = (i: number) =>
    setPresent((p) => p.map((v, j) => (j === i ? !v : v)));

  const { posterior, contributions, logOdds } = useMemo(() => {
    // start from the prior log-odds: log P(spam) - log P(ham)
    const base = Math.log(prior) - Math.log(1 - prior);
    let total = base;
    const contribs: { word: Word; lr: number; dLog: number }[] = [];
    present.forEach((on, i) => {
      if (!on) return;
      const w = WORDS[i];
      const lr = w.pSpam / w.pHam; // likelihood ratio
      const dLog = Math.log(lr); // additive in log space
      total += dLog;
      contribs.push({ word: w, lr, dLog });
    });
    // convert log-odds back to a probability via the logistic function
    const post = 1 / (1 + Math.exp(-total));
    return { posterior: post, contributions: contribs, logOdds: total };
  }, [present, prior]);

  const isSpam = posterior > 0.5;
  const pct = Math.round(posterior * 1000) / 10;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* word toggles */}
      <p class="mb-2 text-sm text-muted">
        Tap the words that appear in the email:
      </p>
      <div class="mb-4 flex flex-wrap gap-2">
        {WORDS.map((w, i) => {
          const on = present[i];
          const spammy = w.pSpam > w.pHam;
          return (
            <button
              key={w.text}
              onClick={() => toggle(i)}
              class={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                on
                  ? 'bg-brand text-white border-transparent'
                  : 'bg-surface-2 text-muted border-border hover:text-text'
              }`}
            >
              <span>{w.text}</span>
              <span class={`ml-2 text-xs font-normal ${on ? 'text-white/80' : 'text-muted'}`}>
                {spammy ? '↑spam' : '↑ham'}
              </span>
            </button>
          );
        })}
      </div>

      {/* prior slider */}
      <label class="mb-4 block">
        <span class="mb-1 block text-sm text-muted">
          prior P(spam) = {prior.toFixed(2)}
        </span>
        <input
          type="range"
          min={0.02}
          max={0.9}
          step={0.01}
          value={prior}
          onInput={(e) => setPrior(parseFloat((e.target as HTMLInputElement).value))}
          class="w-full accent-[#4f46e5]"
        />
      </label>

      {/* gauge + verdict */}
      <div class="rounded-xl bg-surface-2 p-4">
        <div class="mb-1 flex items-baseline justify-between">
          <span class="text-sm text-muted">P(spam | email)</span>
          <span class="font-mono text-2xl font-bold" style={`color:${isSpam ? COLORS.spam : COLORS.ham}`}>
            {pct.toFixed(1)}%
          </span>
        </div>
        <div class="h-4 w-full overflow-hidden rounded-full bg-border">
          <div
            class="h-full rounded-full transition-all"
            style={`width:${posterior * 100}%;background:${isSpam ? COLORS.spam : COLORS.ham}`}
          />
        </div>
        <div class="mt-2 flex items-center justify-between text-xs text-muted">
          <span>ham</span>
          <span>0.5 threshold</span>
          <span>spam</span>
        </div>
        <div class="mt-3 text-center">
          <span
            class="inline-block rounded-full px-4 py-1 text-sm font-bold text-white"
            style={`background:${isSpam ? COLORS.spam : COLORS.ham}`}
          >
            {isSpam ? 'SPAM 🚫' : 'HAM ✅'}
          </span>
        </div>
      </div>

      {/* per-word contributions */}
      <div class="mt-4 space-y-2 text-sm">
        <Readout label="prior log-odds" value={(Math.log(prior) - Math.log(1 - prior)).toFixed(2)} />
        {contributions.length === 0 ? (
          <p class="text-xs text-muted">
            No words selected — the verdict is just the prior. Toggle a word to see it push the
            odds up (spammy) or down (hammy).
          </p>
        ) : (
          contributions.map((c) => (
            <div key={c.word.text} class="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
              <span class="font-mono font-semibold">{c.word.text}</span>
              <span class="text-xs text-muted">
                LR = {c.word.pSpam.toFixed(3)} / {c.word.pHam.toFixed(3)} = {c.lr.toFixed(1)}×
              </span>
              <span
                class="font-mono font-semibold"
                style={`color:${c.dLog >= 0 ? COLORS.spam : COLORS.ham}`}
              >
                {c.dLog >= 0 ? '+' : ''}
                {c.dLog.toFixed(2)}
              </span>
            </div>
          ))
        )}
        <Readout label="total log-odds" value={logOdds.toFixed(2)} accent />
      </div>
    </div>
  );
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div class="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <span class="font-mono font-semibold" style={accent ? `color:${COLORS.accent}` : ''}>
        {value}
      </span>
    </div>
  );
}
