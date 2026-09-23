import { component$ } from "@qwik.dev/core";
import type { RequestHandler } from "@qwik.dev/router";

import { redirectCanonical } from "~/server/posts";

export const onGet: RequestHandler = (event) => redirectCanonical(event, "/");
export const onHead: RequestHandler = onGet;

export default component$(() => null);
