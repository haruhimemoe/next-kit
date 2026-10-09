/**
 * @file src/pwa/app.ts
 * @desc What an app tells the pwa helpers about itself (PwaApp), and the surface color its
 *       installed window and splash screen use: the ui theme's b5 at the app's hue, so the
 *       status bar matches the page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

/** An app as the pwa helpers need it. */
export type PwaApp = {
  /** The full name, like "pools.haruhime.moe". Shown on the install prompt. */
  name: string;
  /** The home-screen label, 12 characters or fewer, like "pools". */
  shortName: string;
  /** One sentence for the install prompt. */
  description: string;
  /** The app's ui hue (its globals.css `--hue`). */
  hue: number;
  /** Which ui theme the app paints. Default "dark"; harumin is "light". */
  scheme?: "dark" | "light";
};

const LIGHTNESS = { dark: 15, light: 97 } as const;
const SATURATION = 10;

/**
 * @function hslHex
 * @param h {number} hue in degrees
 * @param s {number} saturation, 0 to 100
 * @param l {number} lightness, 0 to 100
 * @returns {string} the color as "#rrggbb"
 */
export const hslHex = (h: number, s: number, l: number): string => {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
};

/**
 * @function surfaceColor
 * @param app {Pick<PwaApp, "hue" | "scheme">} the app's hue and theme
 * @returns {string} the ui theme's page color (b5) as "#rrggbb"
 */
export const surfaceColor = ({ hue, scheme = "dark" }: Pick<PwaApp, "hue" | "scheme">): string =>
  hslHex(((hue % 360) + 360) % 360, SATURATION, LIGHTNESS[scheme]);

/**
 * @function textColor
 * @param app {Pick<PwaApp, "hue" | "scheme">} the app's hue and theme
 * @returns {string} the ui theme's main text color (c1) as "#rrggbb"
 */
export const textColor = ({ hue, scheme = "dark" }: Pick<PwaApp, "hue" | "scheme">): string =>
  hslHex(((hue % 360) + 360) % 360, 40, scheme === "dark" ? 100 : 10);
