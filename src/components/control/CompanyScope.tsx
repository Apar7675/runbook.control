"use client";

import React, { createContext, useContext, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isPlatformPage } from "@/lib/control/companyScope";

type Scope = { selectedId: string | null };
const Context = createContext<Scope>({ selectedId: null });
export function useCompanyScope() { return useContext(Context); }

export default function CompanyScope({ selectedId = null, children }: { selectedId?: string | null; children: React.ReactNode }) {
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  return <Context.Provider value={{ selectedId }}>{children}</Context.Provider>;
}


export function CompanyScopeNotice() {
  const pathname = usePathname(); const params = useSearchParams();
  if (!isPlatformPage(pathname, new URLSearchParams(params.toString()))) return null;
  return <div role="note" aria-label="Platform-wide page" style={{ padding: "6px 10px", border: "1.25px solid #5E7DA5", borderRadius: 7, background: "#EDF3FC", fontSize: 13 }}>Platform-wide administration. Shop context is retained for shop pages.</div>;
}

export function CompanyForm({ children, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  const { selectedId } = useCompanyScope();
  return <form {...props}>{selectedId ? <input type="hidden" name="company" value={selectedId} /> : null}{children}</form>;
}
