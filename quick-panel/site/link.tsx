import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { navigateTo } from "./routing";
export default function PreviewLink({
  href = "",
  onClick,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    navigateTo(href);
  }
  return (
    <a {...props} href={href} onClick={click}>
      {children}
    </a>
  );
}
