/* oxlint-disable typescript/no-unsafe-type-assertion */
import { describe, expect, it } from "vite-plus/test";

import type { EditorHandle, EditorRuntimeModule } from "./editor-controller";
import { createEditorController } from "./editor-controller";

function fakeHandle(editableStates: boolean[]): EditorHandle {
  return {
    setEditable(editable) {
      editableStates.push(editable);
    },
    run() {
      return true;
    },
    getJSON() {
      return { type: "doc", content: [{ type: "paragraph" }] };
    },
    getMarkdown() {
      return "本文\n";
    },
    destroy() {},
  };
}

describe("editor controller", () => {
  it("keeps one editor handle across edit and view toggles", async () => {
    const editableStates: boolean[] = [];
    let loadCount = 0;
    const runtime: EditorRuntimeModule = {
      mountArticleEditor() {
        return fakeHandle(editableStates);
      },
    };
    const controller = createEditorController(async () => {
      loadCount += 1;
      return runtime;
    });
    const element = { innerHTML: "<p>静的本文</p>" } as HTMLElement;

    await controller.enterEdit(element);
    controller.enterView();
    await controller.enterEdit(element);

    expect(loadCount).toBe(1);
    expect(editableStates).toEqual([true, false, true]);
  });

  it("leaves static content intact when runtime loading fails", async () => {
    const controller = createEditorController(async () => {
      throw new Error("offline");
    });
    const element = { innerHTML: "<p>静的本文</p>" } as HTMLElement;

    await expect(controller.enterEdit(element)).rejects.toThrow("offline");

    expect(element.innerHTML).toBe("<p>静的本文</p>");
    expect(controller.isReady()).toBe(false);
  });

  it("forwards an edited formula to the mounted editor", async () => {
    const commands: unknown[] = [];
    const handle = fakeHandle([]);
    handle.run = (command) => {
      commands.push(command);
      return true;
    };
    const controller = createEditorController(async () => ({
      mountArticleEditor: () => handle,
    }));

    await controller.enterEdit({ innerHTML: "" } as HTMLElement);
    controller.run({ type: "updateMath", kind: "block", position: 12, latex: "x^2" });

    expect(commands).toEqual([{ type: "updateMath", kind: "block", position: 12, latex: "x^2" }]);
  });

  it("forwards a code language selected from a code block", async () => {
    const commands: unknown[] = [];
    const handle = fakeHandle([]);
    handle.run = (command) => {
      commands.push(command);
      return true;
    };
    const controller = createEditorController(async () => ({ mountArticleEditor: () => handle }));

    await controller.enterEdit({ innerHTML: "" } as HTMLElement);
    controller.run({ type: "setCodeLanguage", position: 8, language: "typescript" });

    expect(commands).toEqual([{ type: "setCodeLanguage", position: 8, language: "typescript" }]);
  });
});
