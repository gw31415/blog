import { sync$ } from "@qwik.dev/core";

export const singleLineInput = sync$((event: InputEvent) => {
  if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak")
    event.preventDefault();
});
export const singleLinePaste = sync$((event: ClipboardEvent) => {
  event.preventDefault();
  document.execCommand(
    "insertText",
    false,
    (event.clipboardData?.getData("text/plain") ?? "").replace(/[\r\n\u2028\u2029]+/g, " "),
  );
});
export const singleLineKey = sync$((event: KeyboardEvent) => {
  if (!event.isComposing && event.key === "Enter") event.preventDefault();
});
