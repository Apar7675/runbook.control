"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { companyHref, isPlatformPage, type CompanyOption } from "@/lib/control/companyScope";

type Scope = { companies: CompanyOption[]; selectedId: string | null; unavailable: boolean; error: string | null; pending: boolean; navigate: (href: string) => void };
const Context = createContext<Scope>({ companies: [], selectedId: null, unavailable: false, error: null, pending: false, navigate: () => {} });
export function useCompanyScope() { return useContext(Context); }

export default function CompanyScope({ companies = [], selectedId = null, unavailable = false, error = null, children }: { companies?: CompanyOption[]; selectedId?: string | null; unavailable?: boolean; error?: string | null; children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  const navigating = useRef(false);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  const navigate = (href: string) => {
    if (navigating.current) return;
    navigating.current = true;
    flushSync(() => setPending(true));
    window.location.assign(href);
  };
  return <Context.Provider value={{ companies, selectedId, unavailable, error, pending, navigate }}>
    <div className="control-company-context" data-switching={pending || undefined} style={{ display: "contents" }}>
      <div inert={pending} style={{ display: "contents" }}>{children}</div>
      {pending ? <div role="status" aria-live="polite" style={{ position: "fixed", inset: "35% 20% auto", padding: 20, border: "1.25px solid #5E7DA5", borderRadius: 9, background: "#FFFFFF", color: "#12234A", zIndex: 20 }}>Loading company...</div> : null}
      <style>{`.control-company-context[data-switching] .control-main { visibility:hidden; } .control-company-context[data-switching] .control-company-picker { pointer-events:none; opacity:0.6; }`}</style>
    </div>
  </Context.Provider>;
}

export function CompanySelector() {
  const scope = useCompanyScope();
  const pathname = usePathname();
  const search = useSearchParams();
  return <div className="control-company-picker" style={{ display: "grid", gap: 4 }}>
    <label htmlFor="control-company" style={{ fontSize: 12, color: "#A9BFDD" }}>Company</label>
    <select id="control-company" aria-label="Company" value={scope.selectedId ?? ""} disabled={scope.pending || Boolean(scope.error) || scope.companies.length === 0} aria-busy={scope.pending} onChange={(event) => {
      if (scope.companies.some((company) => company.id === event.target.value) && event.target.value !== scope.selectedId) scope.navigate(companyHref(`${pathname}?${search.toString()}`, event.target.value, true));
    }} style={{ width: "100%", minWidth: 0, minHeight: 34, padding: "5px 8px", border: "1px solid #355777", borderRadius: 7, background: "#132A46", color: "#F5F8FF", fontSize: 14 }}>
      {!scope.selectedId ? <option value="" disabled>{scope.error ? "Companies unavailable" : scope.unavailable ? "Choose another company" : "No available companies"}</option> : null}
      {scope.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
    </select>
    {scope.error ? <><span role="alert" style={{ fontSize: 12, color: "#FFADB8" }}>{scope.error}</span><button type="button" onClick={() => window.location.reload()}>Retry companies</button></> : null}
  </div>;
}

export function CompanyScopeNotice() {
  const pathname = usePathname(); const params = useSearchParams();
  if (!isPlatformPage(pathname, new URLSearchParams(params.toString()))) return null;
  return <div role="note" aria-label="Platform-wide page" style={{ padding: "6px 10px", border: "1.25px solid #5E7DA5", borderRadius: 7, background: "#EDF3FC", fontSize: 13 }}>Platform-wide administration. Company selection is retained for company pages.</div>;
}

export function CompanyForm({ children, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  const { selectedId } = useCompanyScope();
  return <form {...props}>{selectedId ? <input type="hidden" name="company" value={selectedId} /> : null}{children}</form>;
}
