"use client";
import React from "react";
import Link from "next/link";
import { companyHref } from "@/lib/control/companyScope";
import { useCompanyScope } from "@/components/control/CompanyScope";

/** Real hrefs support keyboard/new-tab use. Fresh document requests retire company-bound clients. */
export default function CompanyLink(props: React.ComponentProps<typeof Link>) {
  const { selectedId } = useCompanyScope();
  const href = typeof props.href === "string" ? companyHref(props.href, selectedId) : props.href;
  return <Link {...props} href={href} prefetch={false} onClick={(event) => {
    props.onClick?.(event);
    if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!props.target || props.target === "_self")) {
      event.preventDefault(); window.location.assign(href);
    }
  }} />;
}
