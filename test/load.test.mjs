import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createExtensionRuntime } from "@earendil-works/pi-coding-agent";

const { loadExtensions } = await import(new URL("./core/extensions/loader.js", import.meta.resolve("@earendil-works/pi-coding-agent")));

test("Pi loads taller-editor and registers its capability", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const result = await loadExtensions([fileURLToPath(new URL("../index.ts", import.meta.url))], root, undefined, createExtensionRuntime());
  assert.deepEqual(result.errors, [], "Pi must load the extension without errors");
  assert.equal(result.extensions.length, 1);
  const extension = result.extensions[0];
  assert.ok(
    extension.handlers.has("session_start") || extension.shortcuts.has("session_start") || extension.commands.has("session_start") || extension.tools.has("session_start"),
    "The extension must register session_start",
  );
});
