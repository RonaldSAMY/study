import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { ALL_LESSONS } from '../data/curriculum';

/** Rough plain-text extraction from raw MDX for the search index. */
function strip(mdx: string): string {
  return mdx
    .replace(/```[\s\S]*?```/g, ' ')          // fenced code
    .replace(/^import\s.*$/gm, ' ')           // import lines
    .replace(/^export\s.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')                 // JSX / HTML tags
    .replace(/\((?:https?:|\/)[^)]*\)/g, ' ') // markdown link targets (url)
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')        // display math
    .replace(/\$[^$\n]*\$/g, ' ')             // inline math
    .replace(/[#*_`>~\\{}\[\]|]/g, ' ')       // markdown symbols
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);
}

export const GET: APIRoute = async () => {
  const entries = await getCollection('lessons');
  const bodyBySlug = new Map(entries.map((e) => [e.slug, e.body]));

  const docs = ALL_LESSONS.map((l) => ({
    slug: l.slug,
    title: l.title,
    summary: l.summary,
    track: l.trackTitle,
    icon: l.trackIcon,
    stage: l.stage,
    ready: bodyBySlug.has(l.slug),
    text: bodyBySlug.has(l.slug) ? strip(bodyBySlug.get(l.slug)!) : '',
  }));

  return new Response(JSON.stringify(docs), {
    headers: { 'Content-Type': 'application/json' },
  });
};
