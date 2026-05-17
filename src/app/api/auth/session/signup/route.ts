import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "RunBook Control account signup is disabled. Access is provisioned for platform administrators only.",
    },
    { status: 403 }
  );
}
