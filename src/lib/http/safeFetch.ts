// src/lib/http/safeFetch.ts

export type SafeFetchOk<T> = {
  ok: true;
  status: number;
  data: T;
};

export type SafeFetchErr = {
  ok: false;
  status: number; // 0 when fetch throws (no HTTP response)
  error: string;
  detail?: any;
};

export type SafeFetchResult<T> = SafeFetchOk<T> | SafeFetchErr;

async function readBody(res: Response) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) return await res.json();
    return await res.text();
  } catch {
    return null;
  }
}

export async function safeFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, init);
    const body = await readBody(res);

    if (res.ok) {
      return { ok: true, status: res.status, data: body as T };
    }

    const msg =
      (body && typeof body === "object" && ((body as any).error || (body as any).message)) ||
      (typeof body === "string" && body) ||
      `HTTP ${res.status}`;

    return {
      ok: false,
      status: res.status,
      error: String(msg),
      detail: body,
    };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      error: e?.message ? String(e.message) : "Failed to fetch",
      detail: e,
    };
  }
}
