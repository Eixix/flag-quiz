import flags from "./res/countryFlags.json";
import type { Difficulty } from "./protocol";

const EXPLORER_CODES = new Set([
  "AR", "AU", "AT", "BE", "BR", "CA", "CL", "CN", "CO", "HR",
  "CU", "CZ", "DK", "EG", "FI", "FR", "DE", "GR", "HU", "IS",
  "IN", "ID", "IE", "IL", "IT", "JM", "JP", "KE", "MX", "MA",
  "NL", "NZ", "NG", "NO", "PK", "PE", "PH", "PL", "PT", "RO",
  "SA", "ZA", "KR", "ES", "SE", "CH", "TH", "TR", "UA", "AE",
  "GB", "US", "VE", "VN",
]);

const TERRITORY_CODES = new Set([
  "AI", "AQ", "AS", "AW", "AX", "BL", "BM", "BQ", "BV", "CC",
  "CK", "CW", "CX", "EH", "FK", "FO", "GF", "GG", "GI", "GL",
  "GP", "GS", "GU", "HK", "HM", "IM", "IO", "JE", "KY", "MF",
  "MO", "MP", "MQ", "MS", "NC", "NF", "NU", "PF", "PM", "PN",
  "PR", "RE", "SH", "SJ", "SX", "TC", "TF", "TK", "UM", "VG",
  "VI", "WF", "XK", "YT",
]);

/**
 * Returns a new question pool for a game.
 *
 * `world` deliberately excludes territories, while `expert` includes every
 * answerable flag in the data file. Returning a new array lets the server
 * remove questions without mutating the shared source data.
 */
export function flagCodesForDifficulty(difficulty: Difficulty) {
  const codes = Object.keys(flags);
  if (difficulty === "explorer") return codes.filter((code) => EXPLORER_CODES.has(code));
  if (difficulty === "expert") return codes;
  return codes.filter((code) => !TERRITORY_CODES.has(code));
}
