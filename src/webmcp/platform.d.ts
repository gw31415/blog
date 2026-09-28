import type { ModelContext } from "./browser";

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Navigator {
    /** Compatibility with the earlier WebMCP implementation. */
    modelContext?: ModelContext;
  }
}
