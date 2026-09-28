import type { RequestHandler } from "@qwik.dev/router";
import { llmsText } from "~/webmcp/discovery";

export const onGet: RequestHandler = ({ url, headers, text }) => {
  headers.set("Content-Type", "text/plain; charset=utf-8");
  text(200, llmsText(url.origin));
};
