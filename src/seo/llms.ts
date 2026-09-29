/**
 * @file src/seo/llms.ts
 * @desc /llms.txt (https://llmstxt.org): an H1, a blockquote summary, note paragraphs, then H2
 *       sections of "- [title](url): note" links. /llms-full.txt: whole documents in one file.
 *       And the text/plain response both are served with. One builder, so escaping and section
 *       format stay the same on every site (audit A2).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** One link in a section. */
export type LlmsLink = { title: string; url: string; note?: string };

/** An H2 section of links. A section with no links is left out. */
export type LlmsSection = { heading: string; links: readonly LlmsLink[] };

/** llmsTxt's input. */
export type LlmsTxtOptions = {
  /** The H1, like "pools.haruhime.moe". */
  title: string;
  /** The blockquote: what the site is, in one paragraph. */
  summary: string;
  /** Paragraphs a reader needs before following any link. */
  notes?: readonly string[];
  sections: readonly LlmsSection[];
};

/** One document in llms-full.txt. */
export type LlmsFullPart = { title: string; url?: string; markdown: string };

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Link text can't end the link early: brackets and backslashes are escaped. */
const linkText = (text: string): string => oneLine(text).replace(/[\\[\]]/g, "\\$&");

/** A URL can't hold a space or end the link early: those are percent-encoded. */
const linkUrl = (url: string): string =>
  url.trim().replace(/[\s()<>]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const required = (value: string, what: string): string => {
  const line = oneLine(value);
  if (!line) throw new Error(`seo: llms.txt ${what} can't be blank`);
  return line;
};

/**
 * @function llmsTxt
 * @param options {LlmsTxtOptions} title, summary, notes and link sections
 * @returns {string} the llms.txt body, ending in one newline
 * @throws {Error} when the title, summary, a heading, a link title or a URL is blank
 */
export const llmsTxt = ({ title, summary, notes = [], sections }: LlmsTxtOptions): string => {
  const lines = [`# ${required(title, "title")}`, "", `> ${required(summary, "summary")}`];
  for (const note of notes) {
    const line = oneLine(note);
    if (line) lines.push("", line);
  }
  for (const { heading, links } of sections) {
    if (!links.length) continue;
    lines.push("", `## ${required(heading, "heading")}`, "");
    for (const link of links) {
      const note = link.note ? oneLine(link.note) : "";
      const text = linkText(required(link.title, "link title"));
      const href = linkUrl(required(link.url, "link URL"));
      lines.push(`- [${text}](${href})${note ? `: ${note}` : ""}`);
    }
  }
  return `${lines.join("\n")}\n`;
};

/**
 * @function llmsFull
 * @param parts {readonly LlmsFullPart[]} the documents, in order, as Markdown
 * @param head {{ title: string; summary?: string }} an H1 and summary for the whole file
 * @returns {string} one Markdown file: the head, then each document with its source URL,
 *          separated by horizontal rules, ending in one newline. Each document's Markdown is
 *          kept as is (code blocks included).
 */
export const llmsFull = (
  parts: readonly LlmsFullPart[],
  head?: { title: string; summary?: string },
): string => {
  const blocks: string[] = [];
  if (head) {
    blocks.push(
      [
        `# ${required(head.title, "title")}`,
        ...(head.summary ? ["", `> ${oneLine(head.summary)}`] : []),
      ].join("\n"),
    );
  }
  for (const part of parts) {
    const source = part.url ? `\n\nSource: ${linkUrl(part.url)}` : "";
    blocks.push(`# ${required(part.title, "part title")}${source}\n\n${part.markdown.trim()}`);
  }
  return `${blocks.join("\n\n---\n\n")}\n`;
};

/** textResponse's options. */
export type TextResponseOptions = {
  /** Browser cache seconds. Default 3600. */
  maxAge?: number;
  /** CDN cache seconds. Defaults to maxAge. */
  sMaxAge?: number;
  /** Default "text/plain". /docs/*.md mirrors use "text/markdown". */
  type?: "text/plain" | "text/markdown";
};

/**
 * @function textResponse
 * @param body {string} the text
 * @param options {TextResponseOptions} cache lifetimes and type
 * @returns {Response} 200 with `<type>; charset=utf-8`, public Cache-Control and nosniff
 */
export const textResponse = (body: string, options: TextResponseOptions = {}): Response => {
  const maxAge = options.maxAge ?? 3600;
  return new Response(body, {
    headers: {
      "Content-Type": `${options.type ?? "text/plain"}; charset=utf-8`,
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${options.sMaxAge ?? maxAge}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
};
