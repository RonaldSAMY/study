import { getCollection } from 'astro:content';

/**
 * A lesson is "ready" iff a matching MDX file exists in the content
 * collection (slug "<trackId>/<lessonId>"). This decouples readiness from
 * the `status` field in curriculum.ts, so many authors can add lessons in
 * parallel by only ever creating new MDX files — never editing a shared file.
 */
let cache: Set<string> | null = null;

export async function getReadySlugs(): Promise<Set<string>> {
  if (cache) return cache;
  const entries = await getCollection('lessons');
  cache = new Set(entries.map((e) => e.slug));
  return cache;
}
