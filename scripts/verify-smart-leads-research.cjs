const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source=fs.readFileSync('src/lib/smartLeadsResearch.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleObject={exports:{}};vm.runInNewContext(js,{exports:moduleObject.exports,module:moduleObject,URL});
const {parseResearchQuery,parseResearchResponse}=moduleObject.exports;
const candidate={name:'Synthetic company',website:'https://example.invalid/',industry:'Fixture',phone:'',address:'',reason:'Possible fit only',unknowns:'Demand unknown',sources:[{url:'https://example.invalid/'}]};
function response(){return {status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://example.invalid/',title:'Fixture source'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates:[candidate]})}]}]};}
assert.equal(parseResearchQuery({intent:'Buyers of machined parts',geography:'Fixture region',description:'Fixture target'}).geography,'Fixture region');
assert.throws(()=>parseResearchQuery({intent:'anything',geography:'x',description:'x'}));
assert.throws(()=>parseResearchQuery({intent:'Buyers of machined parts',geography:'',description:'x'}));
assert.equal(parseResearchResponse(response())[0].sources[0].url,'https://example.invalid/');
let input=response();input.output.shift();assert.throws(()=>parseResearchResponse(input));
input=response();input.status='incomplete';assert.throws(()=>parseResearchResponse(input));
input=response();input.output[1].content[0].text=JSON.stringify({candidates:[{...candidate,sources:[{url:'https://invented.invalid/'}]}]});assert.throws(()=>parseResearchResponse(input));
input=response();input.output[1].content[0].text=JSON.stringify({candidates:[{...candidate,sources:[]}]});assert.throws(()=>parseResearchResponse(input));
input=response();input.output[1].content[0].text=JSON.stringify({candidates:[{...candidate,website:'javascript:alert(1)'}]});assert.throws(()=>parseResearchResponse(input));
input=response();input.output[1].content[0].text='not json';assert.throws(()=>parseResearchResponse(input));
input=response();input.output[1].content[0].text=JSON.stringify({candidates:[{...candidate,name:''}]});assert.throws(()=>parseResearchResponse(input));
const route=fs.readFileSync('src/app/api/desktop/ai/leads-research/route.ts','utf8');
for(const guard of ['requireSessionUser(req)','rb_shop_members','rb_devices','getShopEntitlement(shopId)','entitlement.restricted','desktop.leads_research','reservation.error','tool_choice:"required"','store:false'])assert.ok(route.includes(guard),guard);
assert.ok(route.indexOf('getShopEntitlement(shopId)')<route.indexOf('await fetch('));
async function verifyRoute() {
  const routeJs=ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let settings={},dispatches=0;
  const query=()=>{const chain={select:()=>chain,eq:()=>chain,gte:()=>chain,maybeSingle:async()=>settings.value,then:(resolve,reject)=>Promise.resolve(settings.value).then(resolve,reject)};return chain;};
  const admin={from(table){const chain=query();if(table==='rb_shop_members')settings.value={data:settings.member===false?null:{role:'member'}};if(table==='rb_devices')settings.value={data:{id:'device',shop_id:settings.wrongShop?'other':'shop',status:settings.inactive?'disabled':'active'}};if(table==='rb_ai_usage_events'){settings.value={count:settings.limited?20:0,error:settings.usageError?{}:null};chain.insert=async()=>({error:null});}return chain;}};
  const mod={exports:{}};
  vm.runInNewContext(routeJs,{exports:mod.exports,module:mod,Error,AbortSignal,process:{env:{RUNBOOK_LEADS_AI_MODEL:'synthetic',OPENAI_API_KEY:'synthetic-test-only'}},require(name){if(name==='next/server')return {NextResponse:{json:(body,options={})=>({body,status:options.status??200})}};if(name==='@/lib/supabase/admin')return {supabaseAdmin:()=>admin};if(name==='@/lib/desktopAuth')return {requireSessionUser:async()=>{if(settings.noSession)throw Error('Not authenticated');return {user:{id:'fixture-user'}};}};if(name==='@/lib/billing/entitlement')return {getShopEntitlement:async()=>({allowed:!settings.unpaid,restricted:!!settings.unpaid,reason:'Fixture denied'})};if(name==='@/lib/smartLeadsResearch')return moduleObject.exports;throw Error(name);},fetch:async()=>{dispatches++;return {ok:true,json:async()=>response()};}});
  const req={text:async()=>JSON.stringify({shop_id:'shop',device_id:'device',intent:'Buyers of machined parts',geography:'Fixture region',description:'Fixture target'}),signal:new AbortController().signal};
  for(const [flag,status] of [['noSession',401],['member',403],['wrongShop',403],['inactive',403],['unpaid',402],['usageError',503],['limited',429]]){settings={[flag]:flag==='member'?false:true};const result=await mod.exports.POST(req);assert.equal(result.status,status,flag);assert.equal(dispatches,0,flag+' dispatched provider');}
  settings={};const success=await mod.exports.POST(req);assert.equal(success.status,200);assert.equal(success.body.candidates.length,1);assert.equal(dispatches,1);
  console.log('PASS 20 Smart Leads checks: query/source validation plus actual route mocked session, membership, device, paid access, usage refusal and successful sourced response; no live provider or database.');
}
verifyRoute().catch(error=>{console.error(error);process.exitCode=1;});
