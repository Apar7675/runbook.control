import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Legacy check-in removed. Use /api/device/checkin with Authorization: Bearer <device token>.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Legacy check-in removed. Use /api/device/checkin with Authorization: Bearer <device token>.",
    },
    { status: 410 }
  );
}
