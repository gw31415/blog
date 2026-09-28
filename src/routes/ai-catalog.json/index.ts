import type { RequestHandler } from "@qwik.dev/router";
import { aiCatalog } from "~/webmcp/discovery";

export const onGet: RequestHandler = ({ url, json }) => {
  json(200, aiCatalog(url.origin));
};
