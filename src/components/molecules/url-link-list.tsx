import { component$ } from "@qwik.dev/core";

export interface UrlLinkItem {
  href: string;
  label: string;
}

/** URL 直書きリンクのリスト。 */
export const UrlLinkList = component$((props: { items: readonly UrlLinkItem[] }) => {
  return (
    <ul class="link-list">
      {props.items.map((item) => (
        <li key={item.href}>
          <a class="url-link" href={item.href}>
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
});
