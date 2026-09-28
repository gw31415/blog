import type { RequestHandler } from "@qwik.dev/router";
import { agentSkillMediaType, webMcpSkill } from "~/webmcp/discovery";

export const onGet: RequestHandler = ({ url, headers, send }) => {
  headers.set("Content-Type", `${agentSkillMediaType}; charset=utf-8`);
  send(200, webMcpSkill(url.origin));
};
