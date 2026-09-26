/** Browser preference only; authorization must also require BLOG_DEV_SERVER. */
export const DEV_MANAGER_COOKIE = "blog_dev_manager";

export function isDevServer() {
  return import.meta.env.BLOG_DEV_SERVER;
}
