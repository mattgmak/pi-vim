import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CustomEditor } from "@earendil-works/pi-coding-agent";
import { sliceByColumn, stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";

import { ModalEditor } from "../src/index.js";
import { fitModeLabel } from "../src/engine/mode-label.js";
import { sendKeys, setInternalCursor, stubKeybindings, stubTheme, stubTui } from "./harness.js";

const footer = (editor: ModalEditor, width: number): string => editor.render(width).at(-1) ?? "";
const nativeFooter = (editor: ModalEditor, width: number): string =>
  CustomEditor.prototype.render.call(editor, width).at(-1) ?? "";

// Model an optional host's right-aligned context gauge. SDK 1.1.0 supplies
// the centered scroll hint itself, but does not supply a context gauge.
class GaugeEditor extends ModalEditor {
  gauge = " 42% ";

  protected override renderBottomBorder(width: number, hiddenLineCount: number): string {
    const border = super.renderBottomBorder(width, hiddenLineCount);
    const gaugeWidth = visibleWidth(this.gauge);
    return sliceByColumn(border, 0, width - gaugeWidth) + `\x1b[36m${this.gauge}\x1b[39m`;
  }
}

describe("right mode badge rendering", () => {
  it("replaces exactly the right label span without changing other editor lines", () => {
    const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings);
    editor.setText("hello");
    const native = CustomEditor.prototype.render.call(editor, 40);
    const rendered = editor.render(40);

    assert.deepEqual(rendered.slice(0, -1), native.slice(0, -1));
    assert.equal(rendered.at(-1), "─".repeat(32) + " INSERT ");
    sendKeys(editor, ["\x1b"]);
    assert.equal(footer(editor, 40), "─".repeat(32) + " NORMAL ");
  });

  it("preserves the centered native scroll hint and left border prefix", () => {
    const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings);
    editor.setText(Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n"));
    setInternalCursor(editor, 0);
    const native = nativeFooter(editor, 80);
    const rendered = footer(editor, 80);
    const hint = / ↓ \d+ more /.exec(native)?.[0];

    assert.ok(hint, "fixture must have hidden lines below");
    assert.equal(rendered, native.slice(0, -8) + " INSERT ");
    assert.equal(rendered.indexOf(hint), native.indexOf(hint));
    assert.equal(visibleWidth(rendered), 80);
  });

  it("preserves ANSI border colors and centered hint while replacing the rightmost host span", () => {
    const colorize = (text: string): string => `\x1b[35m\x1b[7m${text}\x1b[27m\x1b[39m`;
    const editor = new GaugeEditor(stubTui, stubTheme, stubKeybindings, {
      labelColorizers: { insert: colorize, normal: colorize, visual: colorize, ex: colorize },
    });
    editor.borderColor = (text: string) => `\x1b[32m${text}\x1b[39m`;
    editor.setText(Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n"));
    setInternalCursor(editor, 0);
    const native = nativeFooter(editor, 80);
    const rendered = footer(editor, 80);
    const nativeText = stripTerminalSequences(native);
    const renderedText = stripTerminalSequences(rendered);
    const hint = / ↓ \d+ more /.exec(nativeText)?.[0];

    assert.ok(hint);
    assert.ok(rendered.endsWith(colorize(" INSERT ")));
    assert.equal(renderedText, nativeText.slice(0, -8) + " INSERT ");
    assert.equal(renderedText.indexOf(hint), nativeText.indexOf(hint));
    assert.ok(!renderedText.includes(" 42% "));
    assert.equal(visibleWidth(rendered), 80);
  });

  it("preserves a host gauge's heavy/light fill boundary and inherited colors", () => {
    class FillGaugeEditor extends ModalEditor {
      protected override renderBottomBorder(width: number, hiddenLineCount: number): string {
        const border = super.renderBottomBorder(width, hiddenLineCount);
        const filled = Math.floor(width * 0.42);
        return `\x1b[32m${border.slice(0, filled).replaceAll("─", "━")}` +
          `\x1b[90m${border.slice(filled)}\x1b[39m`;
      }
    }
    const editor = new FillGaugeEditor(stubTui, stubTheme, stubKeybindings);
    editor.setText(Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n"));
    setInternalCursor(editor, 0);
    const native = stripTerminalSequences(nativeFooter(editor, 80));
    const rendered = footer(editor, 80);

    assert.equal(stripTerminalSequences(rendered), native.slice(0, -8) + " INSERT ");
    assert.ok(rendered.startsWith("\x1b[32m" + "━".repeat(33) + "\x1b[90m"));
    assert.equal(visibleWidth(rendered), 80);
  });

  for (const width of [12, 20, 24, 26]) {
    it(`keeps native scrolling border columns outside the badge at width ${width}`, () => {
      const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings);
      editor.setText(Array.from({ length: 30 }, () => "line").join("\n"));
      setInternalCursor(editor, 0);
      const native = nativeFooter(editor, width);
      const rendered = footer(editor, width);

      assert.ok(native.includes("↓"), "fixture must have a scroll hint");
      // Narrow hints can overlap the replaced span: preserve their prefix,
      // rather than shifting the whole hint to make room for the badge.
      assert.equal(rendered, native.slice(0, -8) + " INSERT ");
      assert.equal(visibleWidth(rendered), width);
    });
  }

  for (const width of [0, 1, 4, 7, 8, 9, 12, 20]) {
    it(`fits labels and preserves the available prefix at width ${width}`, () => {
      const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings);
      for (const [keys, rawLabel] of [
        [[], " INSERT "],
        [["\x1b"], " NORMAL "],
        [["v"], " VISUAL "],
        [["V"], " V-LINE "],
        [["\x1b", ":", ...Array.from("averylong界command")], " EX :averylong界command_ "],
      ] as const) {
        sendKeys(editor, [...keys]);
        const label = fitModeLabel(rawLabel, width);
        const labelWidth = visibleWidth(label);
        const native = nativeFooter(editor, width);
        const rendered = footer(editor, width);

        assert.ok(rendered.endsWith(label));
        assert.equal(stripTerminalSequences(rendered),
          stripTerminalSequences(native).slice(0, width - labelWidth) + stripTerminalSequences(label));
        assert.equal(visibleWidth(rendered), width);
      }
    });
  }

  it("reuses the cached composition and refreshes it on width, label, color or border changes", () => {
    let labelColor = "\x1b[35m";
    const colorize = (text: string): string => `${labelColor}${text}\x1b[39m`;
    const editor = new GaugeEditor(stubTui, stubTheme, stubKeybindings, {
      labelColorizers: { insert: colorize, normal: colorize, visual: colorize, ex: colorize },
    });
    // Count compositions rather than merely comparing identical output.
    const cache = (editor as unknown as { lastLineCache: { result: string } }).lastLineCache;
    let result = cache.result;
    let compositions = 0;
    Object.defineProperty(cache, "result", {
      get: () => result,
      set: (value: string) => { result = value; compositions++; },
    });

    const first = footer(editor, 40);
    assert.equal(footer(editor, 40), first);
    assert.equal(compositions, 1);

    assert.equal(visibleWidth(footer(editor, 41)), 41);
    assert.equal(compositions, 2);
    sendKeys(editor, ["\x1b"]);
    assert.ok(footer(editor, 41).endsWith(colorize(" NORMAL ")));
    assert.equal(compositions, 3);
    labelColor = "\x1b[33m";
    assert.ok(footer(editor, 41).endsWith(colorize(" NORMAL ")));
    assert.equal(compositions, 4);
    editor.gauge = " 43% ";
    const changed = footer(editor, 41);
    assert.ok(changed.endsWith(colorize(" NORMAL ")));
    assert.equal(compositions, 5);
    assert.equal(footer(editor, 41), changed);
    assert.equal(compositions, 5);
  });
});

describe("left mode badge rendering", () => {
  it("puts the label at the line start and keeps the rest of the border", () => {
    const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings, { labelSide: "left" });
    editor.setText("hello");
    const native = CustomEditor.prototype.render.call(editor, 40);
    const rendered = editor.render(40);

    assert.deepEqual(rendered.slice(0, -1), native.slice(0, -1));
    assert.equal(rendered.at(-1), " INSERT " + "─".repeat(32));
    sendKeys(editor, ["\x1b"]);
    assert.equal(footer(editor, 40), " NORMAL " + "─".repeat(32));
  });

  it("keeps a host gauge when the label moves to the left", () => {
    const colorize = (text: string): string => `\x1b[35m\x1b[7m${text}\x1b[27m\x1b[39m`;
    const editor = new GaugeEditor(stubTui, stubTheme, stubKeybindings, {
      labelColorizers: { insert: colorize, normal: colorize, visual: colorize, ex: colorize },
      labelSide: "left",
    });
    editor.borderColor = (text: string) => `\x1b[32m${text}\x1b[39m`;
    editor.setText(Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n"));
    setInternalCursor(editor, 0);
    const rendered = footer(editor, 80);

    assert.ok(rendered.startsWith(colorize(" INSERT ")));
    assert.ok(stripTerminalSequences(rendered).includes(" 42% "));
    assert.equal(visibleWidth(rendered), 80);
  });

  for (const width of [8, 12, 20]) {
    it(`replaces the leftmost columns at width ${width}`, () => {
      const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings, { labelSide: "left" });
      const label = fitModeLabel(" INSERT ", width);
      const native = nativeFooter(editor, width);
      const rendered = footer(editor, width);

      assert.equal(
        stripTerminalSequences(rendered),
        stripTerminalSequences(label) +
          stripTerminalSequences(native).slice(visibleWidth(label), width),
      );
      assert.equal(visibleWidth(rendered), width);
    });
  }
});

describe("prompt marker rendering", () => {
  const composerLine = (editor: ModalEditor, width = 40): string =>
    stripTerminalSequences(editor.render(width)[1] ?? "");
  const nativeComposerLine = (editor: ModalEditor, width = 40): string =>
    stripTerminalSequences(CustomEditor.prototype.render.call(editor, width)[1] ?? "");
  const footerLine = (editor: ModalEditor, width = 40): string =>
    stripTerminalSequences(editor.render(width).at(-1) ?? "");

  it("keeps the composer line untouched while the setting is off", () => {
    const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings);
    editor.setText("hello");
    assert.equal(composerLine(editor), nativeComposerLine(editor));
  });

  it("prefixes the composer text with the mode letter", () => {
    const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings, {
      promptMarker: true,
    });
    editor.setText("hello");
    const rendered = editor.render(40);

    assert.equal(stripTerminalSequences(rendered[1]).trimEnd(), " I hello");
    assert.equal(stripTerminalSequences(rendered[0]), "─".repeat(40));
  });

  it("shortens the composer line instead of exceeding the width", () => {
    const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings, {
      promptMarker: true,
    });
    editor.setText("hello world");

    assert.equal(composerLine(editor, 6), " I hel");
  });

  it("skips the marker when the width holds no text", () => {
    const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings, {
      promptMarker: true,
    });
    editor.setText("hi");

    assert.equal(composerLine(editor, 3), nativeComposerLine(editor, 3));
  });

  it("pairs with the left label side", () => {
    const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings, {
      promptMarker: true,
      labelSide: "left",
    });
    editor.setText("hello");

    assert.equal(composerLine(editor).trimEnd(), " I hello");
    assert.ok(footerLine(editor).startsWith(" INSERT "));
  });

  const modes: Array<[readonly string[], string]> = [
    [[], "I"],
    [["\x1b"], "N"],
    [["\x1b", "v"], "V"],
    [["\x1b", "V"], "L"],
  ];
  for (const [keys, letter] of modes) {
    it("marks the mode " + letter, () => {
      const editor = new ModalEditor(stubTui, stubTheme, stubKeybindings, {
        promptMarker: true,
      });
      editor.setText("x");
      sendKeys(editor, [...keys]);
      assert.equal(composerLine(editor).slice(0, 3), " " + letter + " ");
    });
  }
});
