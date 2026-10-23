/** URL state only. This hint never grants company access. */
export type CompanyOption = { id: string; name: string };
export const COMPANY_HEADER = "x-control-company";

export function companyRequest(pathname: string, params: URLSearchParams): string {
  // Shops is the authorized directory, independent of the last viewed shop.
  if (pathname === "/shops") return "";
  const direct = pathname.match(/^\/shops\/([^/]+)(?:\/|$)/)?.[1];
  const raw = (params.get("company") || params.get("shop") || params.get("shop_id") || (direct && direct !== "new" ? direct : "") || "").trim();
  if (params.getAll("company").length > 1 || (raw && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(raw))) return "__invalid_company__";
  return raw;
}

export function resolveCompany<T extends CompanyOption>(companies: T[], requested: string) {
  const selected = requested ? companies.find((company) => company.id === requested) ?? null : companies[0] ?? null;
  return { selected, unavailable: Boolean(requested && !selected) };
}

export function companyHref(href: string, companyId: string | null, switching = false): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://control.invalid");
  if (url.pathname === "/shops") {
    for (const key of ["company", "shop", "shop_id"]) url.searchParams.delete(key);
    return url.pathname + url.search + url.hash;
  }
  // An explicit shop link opens that shop, even from another shop context.
  const direct = url.pathname.match(/^\/shops\/([^/]+)(?:\/|$)/)?.[1];
  if (!switching && direct && direct !== "new") companyId = direct;
  if (!companyId) return href;
  if (/^\/(login|auth|mfa|reset-password|restricted)(\/|$)/.test(url.pathname)) return href;
  if (url.pathname.startsWith("/api/")) {
    if (/^\/api\/audit\/(export|list)$/.test(url.pathname)) url.searchParams.set("shop_id", companyId);
    return url.pathname + url.search + url.hash;
  }
  if (switching) {
    for (const key of ["company", "shop", "shop_id", "page", "before", "cursor", "q"]) url.searchParams.delete(key);
    if (/^\/devices\/[^/]+/.test(url.pathname)) url.pathname = "/devices";
    if (/^\/shops\/[^/]+/.test(url.pathname) && !url.pathname.startsWith("/shops/new")) url.pathname = `/shops/${encodeURIComponent(companyId)}`;
  }
  url.searchParams.set("company", companyId);
  return url.pathname + url.search + url.hash;
}

export function isPlatformPage(pathname: string, params: URLSearchParams): boolean {
  return pathname === "/status" || pathname.startsWith("/software-updates") || pathname.startsWith("/updates/packages") || pathname.startsWith("/shops/new") || (pathname === "/people" && params.get("tab") === "control");
}
