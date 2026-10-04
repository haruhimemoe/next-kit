/**
 * @file tests/docs/markdown.test.ts
 * @desc mdxToMarkdown's conversion rules, one `it` per rule, plus the brief's fixtures: fences
 *       are left untouched, transforms run before any rule, and `./docs` stays pure (no node:
 *       imports outside `files/`).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mdxToMarkdown } from "../../src/docs/markdown.js";

const opts = { title: "T", siteUrl: "https://x.haruhime.moe" };

describe("mdxToMarkdown", () => {
  it("leaves fences alone", () => {
    const src =
      '# T\n\n```tsx\nimport x from "y";\n<Callout>no</Callout>\n# not a title\n](/a)\n```\n';
    expect(mdxToMarkdown(src, opts)).toBe(src);
  });

  it("I1: leaves a fence indented inside a list item untouched", () => {
    const src = "# T\n\n1. Step\n\n   ```sh\n   <Callout>no</Callout>\n   ](/a)\n   ```\n";
    expect(mdxToMarkdown(src, opts)).toBe(src);
  });

  it("I2: converts a callout whose body contains a fenced code block", () => {
    const src = '<Callout type="warning">\nBefore.\n\n```sh\nrun this\n```\n\nAfter.\n</Callout>\n';
    expect(mdxToMarkdown(src, opts)).toBe(
      "# T\n\n> **Warning:** Before.\n> \n> ```sh\n> run this\n> ```\n> \n> After.\n",
    );
  });

  it("I2: keeps prose before a fence-spanning callout in the same segment", () => {
    const src = "# T\n\nIntro text.\n\n<Callout>\nFenced below.\n\n```sh\ncode\n```\n</Callout>\n";
    expect(mdxToMarkdown(src, opts)).toBe(
      "# T\n\nIntro text.\n\n\n> **Note:** Fenced below.\n> \n> ```sh\n> code\n> ```\n",
    );
  });

  it("rule 1: normalizes CRLF and CR to LF", () => {
    expect(mdxToMarkdown("# T\r\n\r\nline one\rline two\n", opts)).toBe(
      "# T\n\nline one\nline two\n",
    );
  });

  it("rule 1: runs transforms first", () => {
    expect(mdxToMarkdown("<X/>", { ...opts, transforms: [(s) => s.replace("<X/>", "hi")] })).toBe(
      "# T\n\nhi\n",
    );
  });

  it("rule 2: drops top-level import and export lines", () => {
    expect(mdxToMarkdown('import x from "y";\nexport const z = 1;\nBody text.\n', opts)).toBe(
      "# T\n\nBody text.\n",
    );
  });

  it("rule 2: drops an export const object block up to its closing line", () => {
    const src = 'export const meta = {\n  title: "x",\n};\nBody text.\n';
    expect(mdxToMarkdown(src, opts)).toBe("# T\n\nBody text.\n");
  });

  it("rule 3: converts a callout", () => {
    expect(
      mdxToMarkdown('<Callout type="tip">\nUse a key.\nKeep it secret.\n</Callout>', opts),
    ).toBe("# T\n\n> **Tip:** Use a key.\n> Keep it secret.\n");
  });

  it("rule 3: a missing type means note", () => {
    expect(mdxToMarkdown("<Callout>Heads up.</Callout>", opts)).toBe(
      "# T\n\n> **Note:** Heads up.\n",
    );
  });

  it("rule 3: a title attribute does not change the type label", () => {
    expect(
      mdxToMarkdown('<Callout title="Careful" type="warning">Watch out.</Callout>', opts),
    ).toBe("# T\n\n> **Warning:** Watch out.\n");
  });

  it("rule 4: removes other capitalized JSX tags but keeps the text between them", () => {
    expect(mdxToMarkdown('<Example title="x">keep this</Example>', opts)).toBe(
      "# T\n\nkeep this\n",
    );
  });

  it("rule 4: keeps lowercase HTML tags", () => {
    expect(mdxToMarkdown("a<br/>b", opts)).toBe("# T\n\na<br/>b\n");
  });

  it("rule 5: absolutizes root links, not protocol-relative", () => {
    expect(mdxToMarkdown("[a](/docs/api) [b](//cdn.x/y)", opts)).toBe(
      "# T\n\n[a](https://x.haruhime.moe/docs/api) [b](//cdn.x/y)\n",
    );
  });

  it("rule 5: absolutizes a root-relative image target", () => {
    expect(mdxToMarkdown("![alt](/img/a.png)", opts)).toBe(
      "# T\n\n![alt](https://x.haruhime.moe/img/a.png)\n",
    );
  });

  it("rule 6: prepends the title when the first non-blank line isn't a heading", () => {
    expect(mdxToMarkdown("Body only.\n", opts)).toBe("# T\n\nBody only.\n");
  });

  it("rule 6: leaves an existing heading alone", () => {
    expect(mdxToMarkdown("# Already titled\n\nBody.\n", opts)).toBe("# Already titled\n\nBody.\n");
  });

  it("rule 7: collapses 3+ blank lines to 2", () => {
    // 4 newlines = 3 blank lines, collapses to 2 blank lines (3 newlines).
    const src = `# T${"\n".repeat(4)}A`;
    expect(mdxToMarkdown(src, opts)).toBe(`# T${"\n".repeat(3)}A\n`);
  });

  it("rule 7: trims and ends with exactly one newline", () => {
    expect(mdxToMarkdown("# T\n\nA\n\n\n\n", opts)).toBe("# T\n\nA\n");
  });

  it("keeps ./docs pure: no node: import outside docs/files", () => {
    for (const file of readdirSync(new URL("../../src/docs", import.meta.url), {
      withFileTypes: true,
    })) {
      if (!file.isFile()) continue;
      const text = readFileSync(new URL(`../../src/docs/${file.name}`, import.meta.url), "utf8");
      expect(text, file.name).not.toMatch(/from "node:/);
    }
  });
});
