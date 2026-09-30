import type { ArticleDraft } from "../../content/article";
import type { SaveIntent } from "../../server/posts";

export type DraftSnapshot = ArticleDraft & { alias: string };
export type SaveResult = {
  version: string;
  status: "draft" | "published";
  hasDraft: boolean;
  publishedAt?: string | null;
};
export type AutosaveState = "saved" | "pending" | "saving" | "blocked" | "error";
export interface DraftAutosaver {
  schedule(): void;
  flush(intent?: SaveIntent, keepalive?: boolean): Promise<void>;
  dirty(): boolean;
  dispose(): void;
}

/** One writer per editor. Acknowledgements only clean the snapshot actually sent. */
export function createDraftAutosaver(options: {
  initial: DraftSnapshot;
  read(): DraftSnapshot;
  blocked(): boolean;
  save(draft: DraftSnapshot, intent: SaveIntent, keepalive: boolean): Promise<SaveResult>;
  state(state: AutosaveState, message?: string): void;
  saved(result: SaveResult, intent: SaveIntent): void;
  delay?: number;
}): DraftAutosaver {
  let baseline = JSON.stringify(options.initial);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: Promise<void> | undefined;
  let disposed = false;
  let conflict = false;
  const dirty = () => JSON.stringify(options.read()) !== baseline;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    clear();
    if (disposed || conflict) return;
    if (!dirty()) {
      if (!inflight) options.state("saved");
      return;
    }
    options.state(inflight ? "saving" : "pending");
    timer = setTimeout(() => {
      void flush().catch(() => {});
    }, options.delay ?? 800);
  };
  const flush = async (intent: SaveIntent = "save", keepalive = false): Promise<void> => {
    clear();
    // Queue manual actions behind autosave, then capture the latest input/version.
    // The awaited writer clears inflight in its finally block.
    // eslint-disable-next-line no-unmodified-loop-condition
    while (inflight) await inflight;
    if (disposed) return;
    if (options.blocked()) {
      options.state("blocked");
      if (!keepalive)
        timer = setTimeout(() => {
          void flush().catch(() => {});
        }, options.delay ?? 800);
      throw new Error("入力中のフォームや画像処理を完了してください。");
    }
    if (intent === "save" && !dirty()) {
      options.state("saved");
      return;
    }
    if (conflict)
      throw new Error("CONFLICT: 別の編集が保存されています。入力をコピーして再読込してください。");
    const sent = JSON.stringify(options.read());
    const snapshot: DraftSnapshot = JSON.parse(sent);
    options.state("saving");
    inflight = (async () => {
      try {
        const result = await options.save(snapshot, intent, keepalive);
        if (!snapshot.publishedAt && result.publishedAt)
          snapshot.publishedAt = result.publishedAt.slice(0, 10);
        baseline = JSON.stringify(snapshot);
        options.saved(result, intent);
        options.state(dirty() ? "pending" : "saved");
      } catch (error) {
        const message = error instanceof Error ? error.message : "保存できませんでした。";
        conflict = message.startsWith("CONFLICT:");
        options.state("error", message);
        throw error;
      } finally {
        inflight = undefined;
      }
    })();
    await inflight;
    if (dirty()) schedule();
  };
  return {
    schedule,
    flush,
    dirty,
    dispose: () => {
      disposed = true;
      clear();
    },
  };
}
