import { useState } from 'preact/hooks';

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;       // index of the correct option
  explain: string;      // shown after answering
}

interface Props {
  questions: QuizQuestion[];
}

/** Multiple-choice quiz with instant per-question feedback. */
export default function Quiz({ questions }: Props) {
  const [picked, setPicked] = useState<(number | null)[]>(questions.map(() => null));

  const choose = (qi: number, oi: number) => {
    if (picked[qi] !== null) return; // lock once answered
    setPicked((p) => p.map((v, i) => (i === qi ? oi : v)));
  };

  const correctCount = picked.filter((p, i) => p === questions[i].answer).length;
  const answered = picked.filter((p) => p !== null).length;

  return (
    <div class="not-prose space-y-6">
      {questions.map((question, qi) => {
        const choice = picked[qi];
        const isAnswered = choice !== null;
        return (
          <div key={qi} class="rounded-xl border border-border bg-surface p-5">
            <p class="mb-3 font-semibold">
              <span class="mr-2 text-muted">{qi + 1}.</span>
              {question.q}
            </p>
            <div class="grid gap-2">
              {question.options.map((opt, oi) => {
                const isCorrect = oi === question.answer;
                const isPicked = oi === choice;
                let cls =
                  'flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition ';
                if (!isAnswered) {
                  cls += 'border-border bg-surface-2 hover:border-brand hover:bg-brand-soft cursor-pointer';
                } else if (isCorrect) {
                  cls += 'border-calculus/50 bg-calculus/10 text-calculus';
                } else if (isPicked) {
                  cls += 'border-geometry/50 bg-geometry/10 text-geometry';
                } else {
                  cls += 'border-border bg-surface-2 opacity-60';
                }
                return (
                  <button key={oi} class={cls} disabled={isAnswered} onClick={() => choose(qi, oi)}>
                    <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {isAnswered && (
              <p class="mt-3 animate-fade-up rounded-lg bg-surface-2 p-3 text-sm">
                <strong class={choice === question.answer ? 'text-calculus' : 'text-geometry'}>
                  {choice === question.answer ? 'Correct! ' : 'Not quite. '}
                </strong>
                {question.explain}
              </p>
            )}
          </div>
        );
      })}

      {answered === questions.length && (
        <div class="animate-pop-in rounded-xl border border-brand/30 bg-brand-soft p-4 text-center font-semibold text-brand">
          You scored {correctCount} / {questions.length}
        </div>
      )}
    </div>
  );
}
