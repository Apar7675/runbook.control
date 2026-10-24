import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/desktopAuth";
import { getShopEntitlement } from "@/lib/billing/entitlement";
import { parseResearchQuery, parseResearchResponse, researchPrompt } from "@/lib/smartLeadsResearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { user } = await requireSessionUser(req);
    // Bound the body before JSON parsing; no local company records are accepted.
    const raw = await req.text();
    if (raw.length > 8000) return NextResponse.json({ ok:false,error:"Research request is too large." },{status:413});
    const body = JSON.parse(raw);
    const query = parseResearchQuery(body);
    const shopId = String(body.shop_id ?? "").trim(), deviceId = String(body.device_id ?? "").trim();
    if (!shopId || !deviceId) return NextResponse.json({ ok:false,error:"Current shop and device are required." },{status:400});
    const admin = supabaseAdmin();
    const membership = await admin.from("rb_shop_members").select("role").eq("shop_id",shopId).eq("user_id",user.id).maybeSingle();
    if (membership.error) throw new Error("Company access could not be verified.");
    if (!membership.data) return NextResponse.json({ ok:false,error:"Access denied." },{status:403});
    const device = await admin.from("rb_devices").select("id,shop_id,status").eq("id",deviceId).maybeSingle();
    if (device.error) throw new Error("Device access could not be verified.");
    if (!device.data || device.data.shop_id !== shopId || String(device.data.status).toLowerCase() !== "active")
      return NextResponse.json({ ok:false,error:"This device is not active for the current shop." },{status:403});
    const entitlement = await getShopEntitlement(shopId);
    if (!entitlement.allowed || entitlement.restricted) return NextResponse.json({ ok:false,error:entitlement.reason },{status:402});
    // Ordinary shop subscription only: no module grant, separate license or approval.
    const model = process.env.RUNBOOK_LEADS_AI_MODEL?.trim();
    const key = process.env.OPENAI_API_KEY;
    if (!model || !key) return NextResponse.json({ ok:false,error:"Online research is not configured. Saved-company call preparation remains available." },{status:503});
    const since = new Date(Date.now()-3600000).toISOString();
    const usage = await admin.from("rb_ai_usage_events").select("id",{count:"exact",head:true}).eq("shop_id",shopId).eq("feature","desktop.leads_research").gte("created_at",since);
    if (usage.error) return NextResponse.json({ok:false,error:"Research usage could not be verified. Try again later."},{status:503});
    if ((usage.count ?? 0) >= 20) return NextResponse.json({ok:false,error:"Company research hourly limit reached. Try again later."},{status:429});
    // Reserve before dispatch, including failures. Never log the query or company suggestions remotely.
    const reservation = await admin.from("rb_ai_usage_events").insert({shop_id:shopId,user_id:user.id,device_id:deviceId,feature:"desktop.leads_research",provider:"openai",model,input_tokens:0,output_tokens:0,estimated_cost_usd:0,created_at:new Date().toISOString()});
    if (reservation.error) return NextResponse.json({ok:false,error:"Research usage could not be reserved. Try again later."},{status:503});
    const response = await fetch("https://api.openai.com/v1/responses",{
      method:"POST", headers:{authorization:'Bearer '+key,"content-type":"application/json"},
      signal:AbortSignal.any([req.signal,AbortSignal.timeout(100000)]),
      body:JSON.stringify({model,store:false,tools:[{type:"web_search"}],tool_choice:"required",include:["web_search_call.action.sources"],max_output_tokens:5000,input:researchPrompt(query)})
    });
    if (!response.ok) return NextResponse.json({ok:false,error:"Online research could not finish. No company was saved."},{status:502});
    const candidates = parseResearchResponse(await response.json());
    return NextResponse.json({ok:true,candidates},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research is unavailable.";
    const unauthenticated = /not authenticated/i.test(message);
    return NextResponse.json({ok:false,error:unauthenticated?"Sign in to RunBook Control before researching companies.":"Research could not finish with supported source evidence. No company was saved."},{status:unauthenticated?401:502});
  }
}
