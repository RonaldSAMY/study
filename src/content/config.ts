import { defineCollection, z } from 'astro:content';

/**
 * Lessons are MDX files under src/content/lessons/<trackId>/<lessonId>.mdx
 * The `slug` Astro derives (e.g. "linear-algebra/vectors") matches the
 * curriculum slug in src/data/curriculum.ts.
 */
const lessons = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    track: z.string(), // track id, e.g. "linear-algebra"
    summary: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    estMinutes: z.number().default(12),
    // Prerequisite lesson slugs and what this leads to (powers the flow).
    prereqs: z.array(z.string()).default([]),
    leadsTo: z.array(z.string()).default([]),
  }),
});

export const collections = { lessons };
