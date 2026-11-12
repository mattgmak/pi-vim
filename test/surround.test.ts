import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createEditorWithSpy, sendKeys, setInternalCursor } from "./harness.js";

const ESC = "\x1b";

function createSurroundEditor(text: string, col = 0) {
  const created = createEditorWithSpy(text, { surround: true });
  if (col > 0) setInternalCursor(created.editor, col);
  return created;
}

describe("mini.surround keymap", () => {
  it("sa with a word object wraps the word", () => {
    const { editor } = createSurroundEditor("foo bar");

    sendKeys(editor, ["s", "a", "i", "w", ")"]);

    assert.equal(editor.getText(), "(foo) bar");
    assert.equal(editor.getMode(), "normal");
  });

  it("sa with the line object wraps the whole line", () => {
    const { editor } = createSurroundEditor("  foo");

    sendKeys(editor, ["s", "a", "l", "("]);

    assert.equal(editor.getText(), "  ( foo )");
  });

  it("sd deletes the surrounding quotes", () => {
    const { editor } = createSurroundEditor('"Hello world!"', 8);

    sendKeys(editor, ["s", "d", '"']);

    assert.equal(editor.getText(), "Hello world!");
    assert.equal(editor.getMode(), "normal");
  });

  it("sd deletes a paren pair", () => {
    const { editor } = createSurroundEditor("(123+456)/2", 5);

    sendKeys(editor, ["s", "d", ")"]);

    assert.equal(editor.getText(), "123+456/2");
  });

  it("sr replaces the surrounding quotes", () => {
    const { editor } = createSurroundEditor('"Hello world!"', 8);

    sendKeys(editor, ["s", "r", '"', "'"]);

    assert.equal(editor.getText(), "'Hello world!'");
  });

  it("s with an unmapped key substitutes the char and replays the key", () => {
    const { editor } = createSurroundEditor("foo bar");

    sendKeys(editor, ["s", "x"]);

    assert.equal(editor.getText(), "xoo bar");
    assert.equal(editor.getMode(), "insert");
  });

  it("Escape after s cancels the pending surround", () => {
    const { editor } = createSurroundEditor("foo bar");

    sendKeys(editor, ["s", ESC]);

    assert.equal(editor.getText(), "foo bar");
    assert.equal(editor.getMode(), "normal");
  });

  it("visual sa surrounds the selection", () => {
    const { editor } = createSurroundEditor("foo bar");

    sendKeys(editor, ["v", "e", "s", "a", ")"]);

    assert.equal(editor.getText(), "(foo) bar");
  });

  it("s substitutes the char when surround is off", () => {
    const { editor } = createEditorWithSpy("foo bar");

    sendKeys(editor, ["s"]);

    assert.equal(editor.getText(), "oo bar");
    assert.equal(editor.getMode(), "insert");
  });

  it("d s no longer starts a surround delete", () => {
    const { editor } = createSurroundEditor("foo bar");

    sendKeys(editor, ["d", "s"]);

    assert.equal(editor.getText(), "foo bar");
    assert.equal(editor.getMode(), "normal");
  });
});
