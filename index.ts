import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container } from "@earendil-works/pi-tui";

const MAXIMUM_EDITOR_FRACTION = 0.5;
const MINIMUM_CHAT_ROWS = 8;
const MINIMUM_TEXT_ROWS = 5;
const EDITOR_BORDER_ROWS = 2;
const UPSTREAM_FRACTION = 0.3;

class TallerEditor extends CustomEditor {
  override render(width: number): string[] {
    const realTui = this.tui;
    // Pi mounts the transcript first, followed by the input dock's components.
    const otherDockRows = realTui.children.slice(1)
      .filter((component) => !(component instanceof Container && component.children.includes(this)))
      .reduce((rows, component) => rows + component.render(width).length, 0);
    const autocompleteRows = this.isShowingAutocomplete() ? this.getAutocompleteMaxVisible() + 1 : 0;
    const maximumEditorRows = Math.min(
      Math.floor(realTui.terminal.rows * MAXIMUM_EDITOR_FRACTION),
      realTui.terminal.rows - otherDockRows - MINIMUM_CHAT_ROWS,
    );
    const maximumTextRows = Math.max(MINIMUM_TEXT_ROWS, maximumEditorRows - EDITOR_BORDER_ROWS - autocompleteRows);

    // The SDK has no height option. Change only the row count used by native rendering.
    this.tui = new Proxy(realTui, {
      get(target, prop) {
        if (prop !== "terminal") {
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        }
        return new Proxy(target.terminal, {
          get(terminal, terminalProp) {
            if (terminalProp === "rows") {
              return Math.ceil(maximumTextRows / UPSTREAM_FRACTION);
            }
            const value = Reflect.get(terminal, terminalProp);
            return typeof value === "function" ? value.bind(terminal) : value;
          },
        });
      },
    });
    try {
      return super.render(width);
    } finally {
      this.tui = realTui;
    }
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    ctx.ui.setEditorComponent((tui, theme, keybindings) => new TallerEditor(tui, theme, keybindings));
  });
}
