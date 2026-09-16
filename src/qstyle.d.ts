import type { CssProp } from "@qstyle/qwik";

declare module "@qwik.dev/core/internal" {
  interface HTMLElementAttrs {
    css?: CssProp;
  }
  interface SVGAttributes<T extends Element = Element> {
    css?: CssProp;
  }
}
