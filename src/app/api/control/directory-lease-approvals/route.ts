import { directoryLeaseApprovalPost } from "@/lib/business/directoryTrustAdapters";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// AAL2 is authentication only. SQL requires an explicit live Directory delegation.
export const POST = directoryLeaseApprovalPost;
