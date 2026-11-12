import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentBuffer, currentNumber } from "../src/engine/vim-objects.js";
import { VimBuffer } from "../src/engine/vim-pos.js";

describe("mini.ai number object (iN / aN)", () => {
  const at = (text: string, line: number, col: number) =>
    currentNumber(new VimBuffer(text), { line, col }, 1);

  it("takes the number after the cursor", () => {
    const span = at("foo 42 bar", 0, 0);
    assert.deepEqual(span?.start, { line: 0, col: 4 });
    assert.deepEqual(span?.end, { line: 0, col: 5 });
  });

  it("takes the number the cursor sits on", () => {
    const span = at("foo 42 bar", 0, 5);
    assert.deepEqual(span?.start, { line: 0, col: 4 });
  });

  it("keeps a float in one object", () => {
    const span = at("x = 3.14;", 0, 0);
    assert.deepEqual(span?.start, { line: 0, col: 4 });
    assert.deepEqual(span?.end, { line: 0, col: 7 });
  });

  it("keeps a hex literal in one object", () => {
    const span = at("mask 0x1f00", 0, 0);
    assert.deepEqual(span?.start, { line: 0, col: 5 });
    assert.deepEqual(span?.end, { line: 0, col: 10 });
  });

  it("counts forward for a count", () => {
    const span = at("one 1 two 2", 0, 0);
    assert.ok(span);
    assert.deepEqual(at("one 1 two 2", 0, 0)?.start, { line: 0, col: 4 });
    assert.deepEqual(currentNumber(new VimBuffer("one 1 two 2"), { line: 0, col: 0 }, 2)?.start, {
      line: 0,
      col: 10,
    });
  });

  it("searches the next line when the current one has none", () => {
    const span = at("no digits here", 0, 0);
    assert.equal(span, null);
    assert.deepEqual(
      currentNumber(new VimBuffer("no digits here\nsecond 7"), { line: 0, col: 0 }, 1)?.start,
      { line: 1, col: 7 },
    );
  });
});

describe("mini.ai buffer object (iB / aB)", () => {
  it("covers every line", () => {
    const span = currentBuffer(new VimBuffer("one\ntwo\nthree"));
    assert.deepEqual(span?.start, { line: 0, col: 0 });
    assert.deepEqual(span?.end, { line: 2, col: 0 });
    assert.equal(span?.linewise, true);
  });

  it("covers the single line of a one line buffer", () => {
    const span = currentBuffer(new VimBuffer("one line"));
    assert.deepEqual(span?.start, { line: 0, col: 0 });
    assert.deepEqual(span?.end, { line: 0, col: 0 });
  });
});
