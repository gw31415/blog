import type { RequestHandler } from "@qwik.dev/router";
import { requireManager } from "~/server/access";

// Protect /auth/login in Cloudflare Access. The edge performs the login;
// this handler verifies the resulting identity before returning to the blog.
export const onGet: RequestHandler = async (event) => {
  await requireManager(event);
  throw event.redirect(303, "/");
};
