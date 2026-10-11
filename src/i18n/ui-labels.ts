/**
 * @file src/i18n/ui-labels.ts
 * @desc uiLabels: @haruhimemoe/ui's and next-kit's built-in text from a translator scoped to the
 *       "ui" namespace of @haruhimemoe/messages (next-intl's `getTranslations("ui")` or
 *       `useTranslations("ui")`). Pure: it never loads next-intl, ui or messages, and works on the
 *       server and in client components. The result holds functions, so build it on the side
 *       that renders the component.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

/** A translator for the "ui" namespace: a key like "palette.list", and ICU values. */
export type UiTranslator = (key: string, values?: Record<string, string | number>) => string;

/**
 * @function uiLabels
 * @param t {UiTranslator} the "ui" namespace's translator
 * @returns the label objects ui's components and next-kit's DeleteAccountForm take, plus the
 *          plain text props other components take (`actions`, `forms`, `shell`, `contentNav`)
 */
export const uiLabels = (t: UiTranslator) => {
  const p = (key: string, values?: Record<string, string | number>) => t(`palette.${key}`, values);
  const s = (key: string, values?: Record<string, string | number>) =>
    t(`siteCommands.${key}`, values);
  return {
    palette: {
      results: (count: number) => p("results", { count }),
      list: p("list"),
      searchPlaceholder: p("searchPlaceholder"),
      navigate: p("navigate"),
      select: p("select"),
      back: p("back"),
      close: p("close"),
      required: p("required"),
      enterNumber: p("enterNumber"),
      copied: p("copied"),
      copyFailed: p("copyFailed"),
      recent: p("recent"),
      commands: p("commands"),
      calculator: p("calculator"),
      providerResults: p("providerResults"),
      enterToCopy: p("enterToCopy"),
      typeToSearch: (min: number) => p("typeToSearch", { min }),
      searching: p("searching"),
      searchFailed: p("searchFailed"),
      noResults: (query: string) => p("noResults", { query }),
      noMatches: p("noMatches"),
    },
    /** CommandPalette's own props: `placeholder`, `label`; CommandPaletteButton's `label`. */
    paletteProps: {
      placeholder: p("rootPlaceholder"),
      label: p("label"),
      openLabel: p("openLabel"),
    },
    siteCommands: {
      navigate: s("navigate"),
      page: s("page"),
      account: s("account"),
      help: s("help"),
      goTo: (label: string) => s("goTo", { label }),
      openTool: (name: string) => s("openTool", { name }),
      openHome: s("openHome"),
      allTools: s("allTools"),
      copyUrl: s("copyUrl"),
      back: s("back"),
      top: s("top"),
      reload: s("reload"),
      github: s("github"),
      signIn: s("signIn"),
      myAccount: s("myAccount"),
      signOut: s("signOut"),
      shortcuts: s("shortcuts"),
      filterShortcuts: s("filterShortcuts"),
      reportBug: s("reportBug"),
    },
    codeBlock: {
      copy: t("codeBlock.copy"),
      copied: t("codeBlock.copied"),
      copyFailed: t("codeBlock.copyFailed"),
      code: t("codeBlock.code"),
      copyName: (title: string | null) =>
        title ? t("codeBlock.copyNamed", { title }) : t("codeBlock.copyCode"),
      codeName: (name: string) => t("codeBlock.codeName", { name }),
    },
    contentPage: {
      updated: t("contentPage.updated"),
      readingTime: (minutes: number) => t("contentPage.readingTime", { minutes }),
      and: t("contentPage.and"),
      copyMarkdown: t("contentPage.copyMarkdown"),
      copied: t("contentPage.copied"),
      copyFailed: t("contentPage.copyFailed"),
    },
    contentNav: {
      lastUpdated: t("contentPage.lastUpdated"),
      overview: t("contentNav.overview"),
      contents: t("contentNav.contents"),
      onThisPage: t("contentNav.onThisPage"),
    },
    brandPage: {
      name: t("brandPage.name"),
      logo: t("brandPage.logo"),
      colors: t("brandPage.colors"),
      type: t("brandPage.type"),
      dosAndDonts: t("brandPage.dosAndDonts"),
      do: t("brandPage.do"),
      dont: t("brandPage.dont"),
      osu: t("brandPage.osu"),
      osuNotice: t("brandPage.osuNotice"),
      family: t("brandPage.family"),
      contact: t("brandPage.contact"),
      copied: t("brandPage.copied"),
      copyFailed: t("brandPage.copyFailed"),
    },
    shell: {
      skip: t("shell.skip"),
      mainNav: t("shell.mainNav"),
      footerNav: t("shell.footerNav"),
      tools: t("shell.tools"),
      allTools: t("shell.allTools"),
    },
    actions: {
      copy: t("actions.copy"),
      copied: t("actions.copiedDot"),
      copyFailed: t("actions.copyFailedLong"),
      confirm: t("actions.confirm"),
      cancel: t("actions.cancel"),
      failed: t("actions.failed"),
      previous: t("actions.previous"),
      next: t("actions.next"),
      pages: t("actions.pages"),
      pageStatus: (page: number, count: number | null) =>
        count === null ? t("actions.pageOnly", { page }) : t("actions.pageOf", { page, count }),
      clearFilters: t("actions.clearFilters"),
    },
    forms: {
      visibility: t("forms.visibility"),
      visibilityText: {
        private: { label: t("forms.private"), hint: t("forms.privateHint") },
        unlisted: { label: t("forms.unlisted"), hint: t("forms.unlistedHint") },
        public: { label: t("forms.public"), hint: t("forms.publicHint") },
      },
      report: t("forms.report"),
      reportReason: t("forms.reportReason"),
      sendReport: t("forms.sendReport"),
      sending: t("forms.sending"),
      reportSent: t("forms.reportSent"),
      reportFailed: t("forms.reportFailed"),
      typeToConfirm: (expected: string) => t("forms.typeToConfirm", { expected }),
    },
    account: {
      signIn: t("account.signIn"),
      signInWithOsu: t("account.signInWithOsu"),
      openingOsu: t("account.openingOsu"),
      signOut: t("account.signOut"),
      signingOut: t("account.signingOut"),
      signingIn: t("account.signingIn"),
      home: t("account.home"),
    },
    deleteAccount: {
      trigger: t("account.delete.trigger"),
      title: t("account.delete.title"),
      confirm: t("account.delete.confirm"),
      pending: t("account.delete.pending"),
      typeToConfirm: (username: string) => t("account.delete.typeToConfirm", { username }),
      deleted: t("account.delete.deleted"),
      unreachable: (appName: string) => t("account.delete.unreachable", { appName }),
      failed: (status: number) => t("account.delete.failed", { status }),
    },
  };
};

/** What uiLabels returns. */
export type UiLabels = ReturnType<typeof uiLabels>;
