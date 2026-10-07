/**
 * @file src/api-keys/scopes.ts
 * @desc API key scopes (0.13): what a key may do in its own app. A key carries a list of scope
 *       names; "*" grants every scope, and a key stored before 0.13 (no scopes field) reads as
 *       ["*"], so no migration runs. Scope names are the app's own (read, write for now).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

/** The scope that grants every other one; what a legacy key and a default issue get. */
export const ALL_SCOPES = "*";

const SCOPE_PATTERN = /^[a-z][a-z0-9:_-]{0,31}$/;

/**
 * @function hasScope
 * @param granted {readonly string[]} the key's scopes
 * @param needed {string} the scope a handler needs
 * @returns {boolean} true when the key has it, or has "*"
 */
export const hasScope = (granted: readonly string[], needed: string): boolean =>
  granted.includes(ALL_SCOPES) || granted.includes(needed);

/**
 * @function normalizeScopes
 * @param scopes {readonly string[] | null | undefined} the scopes asked for or stored
 * @param declared {readonly string[] | undefined} the app's declared scope list, if any
 * @returns {string[]} the scopes deduped in order; ["*"] when the field is missing
 * @throws {TypeError} on an empty list, a malformed name, or a name not in `declared`
 */
export const normalizeScopes = (
  scopes: readonly string[] | null | undefined,
  declared?: readonly string[],
): string[] => {
  if (scopes === undefined || scopes === null) return [ALL_SCOPES];
  const unique = [...new Set(scopes)];
  if (unique.length === 0) throw new TypeError("api key scopes: the list is empty");
  for (const scope of unique) {
    if (scope === ALL_SCOPES) continue;
    if (!SCOPE_PATTERN.test(scope)) throw new TypeError(`api key scopes: bad name "${scope}"`);
    if (declared && !declared.includes(scope)) {
      throw new TypeError(`api key scopes: "${scope}" isn't one this app declares`);
    }
  }
  return unique;
};
