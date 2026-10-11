/**
 * @file src/i18n/index.ts
 * @desc @haruhimemoe/next-kit/i18n: locale lists, the locale guard, Accept-Language
 *       negotiation and uiLabels (ui's built-in text from a translator). Pure, never loads next-intl; its glue lives in next-kit/i18n/next-intl.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Sun Oct 11, 2026
 */

export { DEFAULT_LOCALES, hasLocale, type LocaleConfig } from "./locales.js";
export {
  ACCEPT_LANGUAGE_MAX_ENTRIES,
  ACCEPT_LANGUAGE_MAX_LENGTH,
  negotiateLocale,
} from "./negotiate.js";
export { type UiLabels, type UiTranslator, uiLabels } from "./ui-labels.js";
