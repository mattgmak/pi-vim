/**
 * Leap two-key jump: type a pattern, pick a label, jump. Port of
 * andyg/leap.nvim for the composer, with the preview filter from the user's
 * Neovim config (no whitespace, no word-internal letters).
 */
import { getLineGraphemes } from "./motions.js";

export type LeapPos = { line: number; col: number };

export type LeapTarget = {
  pos: LeapPos;
  label: string;
};

/** Label keys in the order hop/Leap order them (English letter frequency). */
export const LEAP_LABEL_KEYS = "sdnuxtvgclbrmwyqzhojkpfi";

/** The key that starts a Leap session: plain Backspace. */
export const LEAP_TRIGGER_KEY = "\x7f";

/** Leap matches the last two typed characters; longer input restarts. */
export const LEAP_PATTERN_LENGTH = 2;

const isLetter = (char: string) => /[a-zA-Z]/.test(char);

/**
 * Preview filter: hide whitespace and letters inside a word, so labels land on
 * word starts and punctuation only.
 */
export function leapPreviewAllowed(
  ch0: string,
  ch1: string,
  ch2: string,
): boolean {
  if (ch1.length === 0 || /\s/.test(ch1)) return false;
  if (isLetter(ch0) && isLetter(ch1) && isLetter(ch2)) return false;
  return true;
}

/** Every shown position of `pattern`, nearest forward match first, then backward. */
export function findLeapMatches(
  lines: readonly string[],
  cursor: LeapPos,
  pattern: string,
): LeapPos[] {
  if (pattern.length === 0) return [];
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const cursorAbs =
    cursor.line < starts.length
      ? starts[cursor.line]! + cursor.col
      : Number.POSITIVE_INFINITY;
  const found: { pos: LeapPos; dist: number; forward: boolean }[] = [];
  for (let line = 0; line < lines.length; line++) {
    const text = lines[line] ?? "";
    for (const grapheme of getLineGraphemes(text)) {
      const at = text.slice(grapheme.start, grapheme.start + pattern.length);
      if (at !== pattern) continue;
      const abs = starts[line]! + grapheme.start;
      if (abs === cursorAbs) continue;
      const forward = abs > cursorAbs;
      const prev = grapheme.start > 0 ? text[grapheme.start - 1]! : "";
      const afterIndex = grapheme.start + pattern.length;
      const next = afterIndex < text.length ? text[afterIndex]! : "";
      if (!leapPreviewAllowed(prev, pattern[0]!, next)) continue;
      found.push({
        pos: { line, col: grapheme.start },
        dist: Math.abs(abs - cursorAbs),
        forward,
      });
    }
  }
  return found
    .sort((a, b) =>
      a.forward !== b.forward
        ? a.forward
          ? -1
          : 1
        : a.dist !== b.dist
          ? a.dist - b.dist
          : a.pos.line !== b.pos.line
            ? a.pos.line - b.pos.line
            : a.pos.col - b.pos.col,
    )
    .map((entry) => entry.pos);
}

/**
 * Attach one label per match, nearest first. Beyond `LEAP_LABEL_KEYS.length`
 * matches the extra candidates stay unreachable, the same cap hop applies.
 */
export function assignLabels(matches: readonly LeapPos[]): LeapTarget[] {
  return matches
    .slice(0, LEAP_LABEL_KEYS.length)
    .map((pos, index) => ({ pos, label: LEAP_LABEL_KEYS[index]! }));
}

/** The target a key selects, or undefined when the key is not a label. */
export function findLeapLabel(
  targets: readonly LeapTarget[],
  key: string,
): LeapTarget | undefined {
  return targets.find((target) => target.label === key);
}

/**
 * The pattern a key produces: the last two characters, so `f` then `o` searches
 * "fo". Falls back to the single key when the pair matches nothing.
 */
export function nextLeapPattern(
  current: string,
  key: string,
  lines: readonly string[],
  cursor: LeapPos,
): string | undefined {
  const pair = (current + key).slice(-LEAP_PATTERN_LENGTH);
  if (pair.length === LEAP_PATTERN_LENGTH && findLeapMatches(lines, cursor, pair).length > 0)
    return pair;
  return findLeapMatches(lines, cursor, key).length > 0 ? key : undefined;
}
