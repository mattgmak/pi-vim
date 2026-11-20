import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LEAP_LABEL_KEYS,
  assignLabels,
  findLeapLabel,
  findLeapMatches,
  leapPreviewAllowed,
  nextLeapPattern,
} from "../src/engine/leap.js";

describe("leap target selection", () => {
  it("hides whitespace and letters inside a word", () => {
    assert.equal(leapPreviewAllowed("a", "b", "c"), false);
    assert.equal(leapPreviewAllowed("a", " ", "b"), false);
    assert.equal(leapPreviewAllowed("", "f", "o"), true);
    assert.equal(leapPreviewAllowed(";", "x", ""), true);
  });

  it("hides letters inside a word, keeps word ends and starts", () => {
    assert.deepEqual(findLeapMatches(["foo bar"], { line: 0, col: 0 }, "o"), [
      { line: 0, col: 2 },
    ]);
    assert.deepEqual(findLeapMatches(["foo bar"], { line: 0, col: 0 }, "b"), [
      { line: 0, col: 4 },
    ]);
  });

  it("ranks the nearest forward match first, then backward", () => {
    const matches = findLeapMatches(["a b a"], { line: 0, col: 2 }, "a");
    assert.deepEqual(matches, [
      { line: 0, col: 4 },
      { line: 0, col: 0 },
    ]);
  });

  it("skips the cursor position and searches every line", () => {
    assert.deepEqual(findLeapMatches(["a"], { line: 0, col: 0 }, "a"), []);
    assert.deepEqual(findLeapMatches(["x", "x"], { line: 0, col: 0 }, "x"), [
      { line: 1, col: 0 },
    ]);
  });

  it("labels matches nearest first and caps at the label alphabet", () => {
    const lines = ["a a a"];
    const targets = assignLabels(findLeapMatches(lines, { line: 0, col: 0 }, "a"));
    assert.equal(targets[0]?.label, LEAP_LABEL_KEYS[0]);
    assert.deepEqual(targets[0]?.pos, { line: 0, col: 2 });
    assert.equal(findLeapLabel(targets, LEAP_LABEL_KEYS[0])?.pos.col, 2);
    assert.equal(findLeapLabel(targets, "z"), undefined);

    const many = assignLabels(
      Array.from({ length: 40 }, (_, index) => ({ line: index, col: 0 })),
    );
    assert.equal(many.length, LEAP_LABEL_KEYS.length);
  });

  it("searches the last two keys and falls back to the single key", () => {
    const lines = ["x foo baz"];
    const cursor = { line: 0, col: 0 };
    assert.equal(nextLeapPattern("f", "o", lines, cursor), "fo");
    assert.equal(nextLeapPattern("f", "z", lines, cursor), "z");
    assert.equal(nextLeapPattern("f", "q", lines, cursor), undefined);
  });
});
