/**
 * @file tests/i18n/ui-labels.test.ts
 * @desc uiLabels: every entry reads its "ui" key, functions pass their ICU values, and nothing
 *       else is read. A fake translator echoes the key and values.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

import { describe, expect, it } from "vitest";
import { uiLabels } from "../../src/i18n/index.js";

const echo = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}${JSON.stringify(values)}` : key;

describe("uiLabels", () => {
  const labels = uiLabels(echo);

  it("maps strings to their keys", () => {
    expect(labels.palette.list).toBe("palette.list");
    expect(labels.paletteProps.placeholder).toBe("palette.rootPlaceholder");
    expect(labels.siteCommands.copyUrl).toBe("siteCommands.copyUrl");
    expect(labels.codeBlock.code).toBe("codeBlock.code");
    expect(labels.contentPage.updated).toBe("contentPage.updated");
    expect(labels.contentNav.contents).toBe("contentNav.contents");
    expect(labels.brandPage.osuNotice).toBe("brandPage.osuNotice");
    expect(labels.shell.skip).toBe("shell.skip");
    expect(labels.actions.copied).toBe("actions.copiedDot");
    expect(labels.forms.visibilityText.unlisted).toEqual({
      label: "forms.unlisted",
      hint: "forms.unlistedHint",
    });
    expect(labels.account.signInWithOsu).toBe("account.signInWithOsu");
    expect(labels.deleteAccount.title).toBe("account.delete.title");
  });

  it("passes values to function entries", () => {
    expect(labels.palette.results(3)).toBe('palette.results{"count":3}');
    expect(labels.palette.typeToSearch(2)).toBe('palette.typeToSearch{"min":2}');
    expect(labels.palette.noResults("x")).toBe('palette.noResults{"query":"x"}');
    expect(labels.siteCommands.goTo("Packs")).toBe('siteCommands.goTo{"label":"Packs"}');
    expect(labels.siteCommands.openTool("bb")).toBe('siteCommands.openTool{"name":"bb"}');
    expect(labels.codeBlock.copyName("a.ts")).toBe('codeBlock.copyNamed{"title":"a.ts"}');
    expect(labels.codeBlock.copyName(null)).toBe("codeBlock.copyCode");
    expect(labels.codeBlock.codeName("ts")).toBe('codeBlock.codeName{"name":"ts"}');
    expect(labels.contentPage.readingTime(4)).toBe('contentPage.readingTime{"minutes":4}');
    expect(labels.actions.pageStatus(2, 5)).toBe('actions.pageOf{"page":2,"count":5}');
    expect(labels.actions.pageStatus(2, null)).toBe('actions.pageOnly{"page":2}');
    expect(labels.forms.typeToConfirm("x")).toBe('forms.typeToConfirm{"expected":"x"}');
    expect(labels.deleteAccount.typeToConfirm("p")).toBe(
      'account.delete.typeToConfirm{"username":"p"}',
    );
    expect(labels.deleteAccount.unreachable("bb")).toBe(
      'account.delete.unreachable{"appName":"bb"}',
    );
    expect(labels.deleteAccount.failed(500)).toBe('account.delete.failed{"status":500}');
  });
});
