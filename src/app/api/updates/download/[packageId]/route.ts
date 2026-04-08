import { NextResponse } from "next/server";
import { getReleaseById } from "@/lib/updates/releases";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ packageId: string }>;
};

export async function GET(req: Request, { params }: Props) {
  try {
    const { packageId } = await params;
    const release = await getReleaseById(packageId);
    if (!release || !release.published_at) {
      return NextResponse.json({ ok: false, error: "Published release not found." }, { status: 404 });
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin.storage.from("rb-updates").createSignedUrl(release.file_path, 300);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Could not create a signed download URL." }, { status: 500 });
    }

    return NextResponse.redirect(data.signedUrl, { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
