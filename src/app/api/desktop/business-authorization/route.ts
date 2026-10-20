import { directoryGrantPost } from "@/lib/business/directoryTrustAdapters";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Explicit trust flag + exact target + actual policy/keys/adapters; absent configuration is OFF.
export const POST = directoryGrantPost;
