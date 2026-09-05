"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";

type SiteLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export default function SiteLink({ children, href, onClick, ...props }: SiteLinkProps) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (event.currentTarget.target && event.currentTarget.target !== "_self")
    ) {
      return;
    }

    event.preventDefault();
    window.location.assign(href);
  }

  return <a {...props} href={href} onClick={navigate}>{children}</a>;
}
