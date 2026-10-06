import { expect, test } from "@playwright/test";

test("inline delimiters work after Japanese text while retaining ASCII boundaries", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "新規記事" }).click();
  const editor = page.locator("article .ProseMirror");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.click();
  const reset = async () => {
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
  };
  for (const [delimiter, tag] of [
    ["**", "strong"],
    ["*", "b"],
    ["_", "i"],
    ["__", "u"],
    ["==", "mark"],
    ["~~", "s"],
  ]) {
    // Exercise boundary categories once, and every delimiter with Japanese and ASCII text.
    for (const prefix of delimiter === "**" ? ["日本語", "𠮷", "😀", "", " "] : ["日本語"]) {
      await reset();
      await page.keyboard.type(prefix + delimiter + "文字" + delimiter);
      await expect(editor.locator(tag)).toHaveText("文字");
      await expect(editor).toHaveText(prefix + "文字");
    }
    for (const prefix of delimiter === "**" ? ["a", ")", "\\"] : ["a"]) {
      await reset();
      const source = prefix + delimiter + "文字" + delimiter;
      await page.keyboard.type(source);
      await expect(editor.locator(tag)).toHaveCount(0);
      await expect(editor).toHaveText(source);
    }
  }
  for (const [delimiter, tag] of [
    ["**", "strong"],
    ["__", "u"],
  ]) {
    await reset();
    await page.keyboard.type("日本語" + delimiter + "文字" + delimiter[0]);
    await expect(editor.locator("strong,b,i,u")).toHaveCount(0);
    await page.keyboard.type(delimiter[1]);
    await expect(editor.locator(tag)).toHaveText("文字");
    await page.keyboard.press("Backspace");
    await expect(editor).toHaveText("日本語" + delimiter + "文字" + delimiter);
  }
});
