import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Blog: drop a Markdown file in src/content/blog/, commit, and it becomes a page
// at /blog/<filename>. Frontmatter is validated against this schema at build.
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(), // also used as the meta description + list excerpt
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false), // drafts are hidden in production builds
    tags: z.array(z.string()).default([]),
    author: z.string().default("Plainvoice"),
  }),
});

export const collections = { blog };
