import assert from "node:assert/strict";
import { test } from "node:test";
import { Container, CURSOR_MARKER, Text, TuiMainScreen } from "@earendil-works/pi-tui";
import tallerEditor from "../index.ts";

const hostIndex = import.meta.resolve("@earendil-works/pi-coding-agent");
const { KeybindingsManager } = await import(new URL("./core/keybindings.js", hostIndex));
const { createChatViewport } = await import(new URL("./modes/interactive/chat-viewport.js", hostIndex));
const { renderLayoutFrame } = await import(new URL("./layout.js", import.meta.resolve("@earendil-works/pi-tui")));
const plain = (text) => text;
const theme = {
  borderColor: plain,
  selectList: { selectedText: plain, description: plain, scrollInfo: plain, noMatch: plain },
};

function createEditor(rows = 24, columns = 40, dockRows = 5) {
  const terminal = { rows, columns, write() {}, hideCursor() {}, showCursor() {} };
  const tui = new TuiMainScreen(terminal);
  let editorFactory;
  tallerEditor({ on: (_event, handler) => handler({}, { mode: "tui", ui: { setEditorComponent: (factory) => { editorFactory = factory; } } }) });
  const editor = editorFactory(tui, theme, new KeybindingsManager());
  editor.focused = true;
  const document = new Container();
  document.addChild(new Text(Array.from({ length: 100 }, (_, index) => `chat ${index}`).join("\n"), 0, 0));
  const pendingMessages = new Container();
  const status = new Container();
  const widgetsAbove = new Container();
  const editorContainer = new Container();
  editorContainer.addChild(editor);
  const widgetsBelow = new Container();
  const footer = new Container();
  footer.addChild(new Text(Array(dockRows).fill("footer").join("\n"), 0, 0));
  for (const component of [document, pendingMessages, status, widgetsAbove, editorContainer, widgetsBelow, footer]) tui.addChild(component);
  const viewport = createChatViewport({ document, pendingMessages, status, widgetsAbove, editor: editorContainer, widgetsBelow, footer });
  return {
    editor, terminal, tui, footer, widgetsAbove,
    frame: () => renderLayoutFrame(viewport.root, terminal.columns, terminal.rows, () => {}),
  };
}

test("a long draft in a zoomed narrow window leaves eight chat rows", () => {
  const { editor, frame } = createEditor();
  editor.setText("a long draft with wrapping words ".repeat(100));
  const rendered = frame();
  assert.ok(rendered.root.children[0].rect.height >= 8, `Expected at least eight chat rows, got ${rendered.root.children[0].rect.height}`);
  assert.ok(editor.render(40).length <= 12, "The whole editor must fit within half of the terminal");
  assert.ok(rendered.lines.some((line) => line.includes(CURSOR_MARKER)), "The cursor must remain visible");
});

test("the editor grows with wrapped text and recomputes its cap after zoom and resize", () => {
  const { editor, terminal, frame } = createEditor(48, 80);
  editor.setText("short");
  assert.equal(editor.render(80).length, 3, "A short draft needs one text row and two borders");
  editor.setText("first\nsecond");
  assert.equal(editor.render(80).length, 4, "A second line grows the editor by one row");
  editor.setText("word ".repeat(500));
  assert.equal(editor.render(80).length, 24);
  terminal.rows = 24;
  terminal.columns = 20;
  assert.equal(editor.render(20).length, 11);
  assert.equal(frame().root.children[0].rect.height, 8);
  assert.equal(terminal.rows, 24, "Sizing must not change the real terminal geometry");
  terminal.rows = 48;
  assert.equal(editor.render(20).length, 24, "The editor can grow again after zooming out");
  editor.setText("short again");
  assert.equal(editor.render(20).length, 3, "Deleting text must shrink the editor");
});

test("footer wrapping and widgets reduce editor space before they reduce the chat reserve", () => {
  const { editor, terminal, footer, widgetsAbove, frame } = createEditor(32, 40, 0);
  footer.clear();
  footer.addChild(new Text("model context and cost ".repeat(8), 0, 0));
  widgetsAbove.addChild(new Text("stashed draft\nteam status", 0, 0));
  editor.setText("draft ".repeat(500));
  const wideHeight = editor.render(40).length;
  terminal.columns = 20;
  const narrowHeight = editor.render(20).length;
  assert.ok(narrowHeight < wideHeight, "A wrapping footer must leave less room for the editor");
  assert.ok(frame().root.children[0].rect.height >= 8, "Eight chat rows must survive footer wrapping");
});

test("autocomplete shares the editor budget instead of taking more chat rows", async () => {
  const { editor, frame } = createEditor(40, 30);
  editor.setAutocompleteProvider({
    async getSuggestions() {
      return { prefix: "/", items: Array.from({ length: 20 }, (_, index) => ({ value: `option-${index}`, label: `option ${index}` })) };
    },
    applyCompletion() { throw new Error("This test does not accept a completion"); },
  });
  editor.setText(`/${"draft ".repeat(500)}`);
  editor.handleInput("\t");
  await new Promise(setImmediate);
  assert.ok(editor.isShowingAutocomplete(), "The real SDK must open the completion menu");
  const lines = editor.render(30);
  assert.ok(lines.some((line) => line.includes("option 0")), "The completion menu must remain visible");
  assert.ok(lines.length <= 20, `Editor and autocomplete must fit in 20 rows, got ${lines.length}`);
  assert.ok(frame().root.children[0].rect.height >= 8);
});

test("scrolling a long draft keeps the cursor visible after the editor shrinks", () => {
  const { editor, terminal, frame } = createEditor(48, 40);
  editor.setText(Array.from({ length: 100 }, (_, index) => `draft ${index}`).join("\n"));
  editor.render(40);
  for (let index = 0; index < 20; index++) editor.handleInput("\x1b[A");
  terminal.rows = 24;
  const rendered = frame();
  assert.equal(editor.getCursor().line, 79);
  assert.ok(rendered.lines.some((line) => line.includes("draft 79") && line.includes(CURSOR_MARKER)));
  assert.ok(editor.render(40).some((line) => line.includes("↑")), "The editor must indicate hidden earlier text");
  assert.ok(editor.render(40).some((line) => line.includes("↓")), "The editor must indicate hidden later text");
});

test("tiny windows retain Pi's five-text-row minimum without growing further", () => {
  const { editor, frame } = createEditor(18, 20);
  editor.setText("draft ".repeat(500));
  assert.equal(editor.render(20).length, 7, "Five text rows and two borders are Pi's native minimum");
  assert.equal(frame().root.children[0].rect.height, 6, "The remaining rows belong to the chat after the five-row footer");
});
