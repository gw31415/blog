import type { RequestHandler } from "@qwik.dev/router";
import { webMcpDiscovery } from "~/webmcp/discovery";

export const onGet: RequestHandler = ({ url, json }) => {
  json(200, webMcpDiscovery(url.origin));
};
