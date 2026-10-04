/**
 * @file src/docs/files/index.ts
 * @desc @haruhimemoe/next-kit/docs/files: reads the markdown files a content registry's entries
 *       point at. Server only: loads node:fs (kept out of the pure `docs` entry point on
 *       purpose). A section's markdown source lives at "<root>/content/<section>/<slug>.mdx";
 *       `readContentMarkdown` converts one with `mdxToMarkdown`, and `contentFileDrift` compares
 *       the registry against the files actually on disk.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CONTENT_SECTIONS,
  type Content,
  type ContentSection,
  findEntry,
  type MarkdownOptions,
  mdxToMarkdown,
} from "../index.js";

const MDX_EXTENSION = ".mdx";

/** Where an entry's source markdown lives, relative to root: "<section>/<slug>.mdx". */
const entryFile = (section: ContentSection, slug: string): string =>
  `${section}/${slug}${MDX_EXTENSION}`;

/**
 * @function readContentMarkdown
 * @param content {Content} a validated registry from `defineContent`
 * @param section {ContentSection} the section the entry lives under
 * @param slug {string} the entry's slug
 * @param options {{ root?: string; siteUrl: string; transforms?: MarkdownOptions["transforms"] }}
 *   `root` defaults to `process.cwd()`; the source file is read from
 *   "<root>/content/<section>/<slug>.mdx"
 * @returns {Promise<string | null>} the converted markdown, or null when the slug isn't
 *   registered in `content`
 * @throws {Error} the file system's ENOENT when the slug is registered but its file is missing
 */
export const readContentMarkdown = async (
  content: Content,
  section: ContentSection,
  slug: string,
  options: { root?: string; siteUrl: string; transforms?: MarkdownOptions["transforms"] },
): Promise<string | null> => {
  const entry = findEntry(content, section, slug);
  if (!entry) return null;
  const root = options.root ?? process.cwd();
  const source = await readFile(join(root, "content", entryFile(section, slug)), "utf8");
  return mdxToMarkdown(source, {
    title: entry.title,
    siteUrl: options.siteUrl,
    ...(options.transforms !== undefined ? { transforms: options.transforms } : {}),
  });
};

/**
 * @function contentFileDrift
 * @param content {Content} a validated registry from `defineContent`
 * @param options {{ root?: string }} `root` defaults to `process.cwd()`
 * @returns {{ missingFiles: string[]; unregistered: string[] }} `missingFiles` lists every
 *   registered entry with no ".mdx" file on disk (like "guides/x.mdx"); `unregistered` lists
 *   every ".mdx" file on disk with no matching registry entry
 */
export const contentFileDrift = (
  content: Content,
  options: { root?: string } = {},
): { missingFiles: string[]; unregistered: string[] } => {
  const root = options.root ?? process.cwd();
  const missingFiles: string[] = [];
  const unregistered: string[] = [];
  for (const section of CONTENT_SECTIONS) {
    const slugs = new Set(content.entries[section].map((entry) => entry.slug));
    for (const slug of slugs) {
      if (!existsSync(join(root, "content", entryFile(section, slug))))
        missingFiles.push(entryFile(section, slug));
    }
    let files: string[];
    try {
      files = readdirSync(join(root, "content", section));
    } catch {
      files = [];
    }
    for (const file of files) {
      if (file.endsWith(MDX_EXTENSION) && !slugs.has(file.slice(0, -MDX_EXTENSION.length)))
        unregistered.push(`${section}/${file}`);
    }
  }
  return { missingFiles, unregistered };
};
