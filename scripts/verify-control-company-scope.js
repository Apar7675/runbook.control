/* Local synthetic verification of real company components and server read models.
   No environment files, real provider calls, persisted users or application data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const Module = require('node:module');
const root = path.resolve(process.env.CONTROL_COMPANY_SOURCE || process.cwd());
const requireRoot = Module.createRequire(path.join(root, 'package.json'));
const evidence = path.resolve(process.env.CONTROL_COMPANY_EVIDENCE || path.join(root, '.local-evidence/company-scope'));
const { componentLoader } = require(path.join(root, 'scripts/verify-control-compact.js'));
const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';
const C = '00000000-0000-4000-8000-0000000000c3';
const stamp = new Date().toISOString();
const companies = [{ id: A, name: 'Synthetic Company A', created_at: stamp, member_role: 'platform_admin' }, { id: B, name: 'Synthetic Company B', created_at: stamp, member_role: 'platform_admin' }];

function database(seed) {
  const calls = [];
  const tables = { ...seed };
  return { calls, tables, from(table) {
    assert(Object.hasOwn(tables, table), 'Unexpected synthetic table: ' + table);
    const call = { table, operations: [], head: false };
    calls.push(call);
    let rows = [...tables[table]], single = false;
    const query = {};
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'lt', 'gte', 'ilike']) query[method] = (...args) => {
      call.operations.push([method, ...args]);
      if (method === 'select') call.head = Boolean(args[1]?.head);
      if (method === 'eq') rows = rows.filter(row => row[args[0]] === args[1]);
      if (method === 'in') rows = rows.filter(row => args[1].includes(row[args[0]]));
      if (method === 'lt') rows = rows.filter(row => String(row[args[0]]) < args[1]);
      if (method === 'gte') rows = rows.filter(row => String(row[args[0]]) >= args[1]);
      if (method === 'ilike') rows = rows.filter(row => String(row[args[0]] || '').toLowerCase().includes(String(args[1]).replaceAll('%', '').toLowerCase()));
      if (method === 'order') rows.sort((a,b) => String(a[args[0]] || '').localeCompare(String(b[args[0]] || '')) * (args[1]?.ascending === false ? -1 : 1));
      if (method === 'limit') rows = rows.slice(0, args[0]);
      if (method === 'maybeSingle') single = true;
      return query;
    };
    query.then = (resolve,reject) => Promise.resolve({ data: call.head ? null : single ? rows[0] || null : rows, error: null, count: rows.length }).then(resolve,reject);
    return query;
  }};
}
function snapshot(company) {
  return { ...company, billing_status: 'active', trial_ends_at: null, grace_ends_at: null, billing_current_period_end: null,
    access: { state: 'active', desktop_mode: 'full', mobile_mode: 'full', workstation_mode: 'full', display_status: 'Active', summary: 'Synthetic company entitlement' },
    counts: { employees_total: 1, employees_active: 1, employees_mobile_ready: 1, employees_workstation_ready: 1, devices_total: 1, devices_active: 1, desktops_total: 1, desktops_active: 1, workstations_total: 0, workstations_active: 0 },
    health: { offline_devices: 0, stale_devices: 0, recent_audit_events: 1, last_device_activity_at: stamp } };
}
function seeds() {
  const device = (id,shop) => ({ id, shop_id: shop.id, rb_shops: { name: shop.name }, name: 'Synthetic device ' + id, status: 'active', device_type: 'desktop', created_at: stamp, last_seen_at: stamp, reported_version: '1.0.0' });
  const employee = (shop,suffix) => ({ id: 'employee-' + suffix, shop_id: shop.id, auth_user_id: 'user-' + suffix, display_name: 'Synthetic employee ' + suffix, email: suffix + '@example.invalid', role: 'operator', status: 'active', is_active: true, mobile_access_enabled: true, mobile_timeclock_enabled: true, mobile_timeclock_requires_review: true, workstation_access_enabled: true, runbook_access_enabled: true, created_at: stamp });
  return {
    rb_shops: companies.map(c => ({ ...c, billing_status: 'active' })), rb_control_admins: [{ user_id: 'synthetic-viewer', created_at: stamp }],
    rb_devices: [...Array.from({length: 600}, (_,i) => device('device-b-' + i, companies[1])), device('device-a', companies[0])],
    rb_device_tokens: [{ id: 'token-a', device_id: 'device-a', created_at: stamp, issued_at: stamp, last_seen_at: stamp, revoked_at: null }],
    rb_device_capability_snapshots: [{ device_id: 'device-b-0', requirements_status: 'fail', reported_at: stamp }, { device_id: 'device-a', requirements_status: 'warning', reported_at: stamp }],
    rb_update_policy: companies.map(c => ({ shop_id: c.id, channel: 'stable', min_version: '1.0.0', pinned_version: null })),
    employees: [employee(companies[1], 'b'), employee(companies[0], 'a')],
    rb_shop_members: companies.map((c,i) => ({ shop_id: c.id, user_id: 'user-' + (i ? 'b' : 'a'), role: 'member', is_active: true, created_at: stamp })),
    rb_profiles: [{ id: 'user-a', first_name: 'Synthetic', last_name: 'A', email: 'a@example.invalid' }, { id: 'user-b', first_name: 'Synthetic', last_name: 'B', email: 'b@example.invalid' }, { id: 'synthetic-viewer', first_name: 'Synthetic', last_name: 'Admin', email: 'admin@example.invalid' }],
    time_events: companies.map((c,i) => ({ id: 'time-' + (i ? 'b' : 'a'), shop_id: c.id, employee_id: 'employee-' + (i ? 'b' : 'a'), created_at: stamp, updated_at: stamp, server_ts: stamp, client_ts: stamp, event_type: 'clock_in', source: 'mobile', is_offline: false, needs_review: true, policy_result: 'review', policy_reason: 'Synthetic review' })),
    rb_audit_log: companies.flatMap((c,i) => Array.from({length: i ? 4 : 3}, (_,n) => ({ id: 'audit-' + c.id + '-' + n, shop_id: c.id, action: 'synthetic_review', created_at: stamp, actor_email: 'reviewer@example.invalid', target_type: 'device', target_id: i ? 'device-b-0' : 'device-a', meta: {} }))),
    rb_support_bundles: companies.map(c => ({ id: 'bundle-' + c.id, shop_id: c.id, file_path: 'synthetic/bundle.zip', created_at: stamp, uploaded_by: 'reviewer@example.invalid' })),
    rb_delete_operations: companies.map(c => ({ id: 'delete-' + c.id, shop_id: c.id, shop_name: c.name, status: 'failed', started_at: stamp, completed_at: null, result_json: {}, error_json: {} })),
  };
}
function assertFilter(call,column,ids) {
  const index = call.operations.findIndex(op => op[0] === 'in' && op[1] === column);
  assert(index >= 0, call.table + ' lacks selected-company filter');
  assert.deepEqual(call.operations[index][2], ids);
  const limit = call.operations.findIndex(op => op[0] === 'limit');
  if (limit >= 0) assert(index < limit, call.table + ' filters after its row limit');
}
async function serverChecks() {
  const authDb = database(seeds());
  let requested = A, user = { id: 'synthetic-viewer', email: 'reviewer@example.invalid' }, userChecks = 0;
  const authLoad = componentLoader({
    'next/headers': { headers: async () => new Headers({ 'x-control-company': requested }) },
    '@/lib/platformAdmin': { isPlatformAdminEmail: () => false },
    '@/lib/supabase/server': { supabaseServer: async () => ({ auth: { getUser: async () => { userChecks++; return { data: { user }, error: null }; } } }) },
    '@/lib/supabase/admin': { supabaseAdmin: () => authDb },
    '@/lib/billing/access': { describeShopAccess: () => snapshot(companies[0]).access },
    '@/lib/billing/entitlement': { getShopEntitlement: async () => ({ status: 'active' }) },
  });
  const summary = authLoad(path.join(root, 'src/lib/control/summary.ts'));
  let ctx = await summary.getViewerContext();
  assert.equal(ctx.selectedCompanyId, A); assert.deepEqual(ctx.shops.map(c => c.id), [A]);
  assert.deepEqual(ctx.authorizedShops.map(c => c.id), [A,B]);
  requested = B; ctx = await summary.getViewerContext(); assert.deepEqual(ctx.shops.map(c => c.id), [B]);
  requested = C; ctx = await summary.getViewerContext(); assert.equal(ctx.companyUnavailable, true); assert.deepEqual(ctx.shops, []);
  requested = A; authDb.tables.rb_shops = [companies[1]]; ctx = await summary.getViewerContext();
  assert.equal(ctx.companyUnavailable, true); assert.deepEqual(ctx.shops, [], 'Revoked/unavailable ID must never fall back');
  requested = ''; ctx = await summary.getViewerContext(); assert.equal(ctx.selectedCompanyId, B, 'Single authorized company is selected');
  authDb.tables.rb_shops = []; ctx = await summary.getViewerContext(); assert.deepEqual(ctx.shops, []); assert.equal(ctx.selectedCompanyId, null);
  assert.equal(summary.selectPrimaryShop([companies[0]], B), null);
  // Ordinary membership is also re-read; client URL hints are never access grants.
  authDb.tables.rb_control_admins = [];
  authDb.tables.rb_shop_members = [{ shop_id: A, user_id: 'synthetic-viewer', role: 'owner', rb_shops: companies[0] }];
  requested = B; ctx = await summary.getViewerContext();
  assert.equal(ctx.isPlatformAdmin, false); assert.deepEqual(ctx.authorizedShops.map(c => c.id), [A]);
  assert.equal(ctx.companyUnavailable, true); assert.deepEqual(ctx.shops, []);
  requested = A; ctx = await summary.getViewerContext(); assert.deepEqual(ctx.shops.map(c => c.id), [A]);
  authDb.tables.rb_shop_members = []; ctx = await summary.getViewerContext();
  assert.equal(ctx.companyUnavailable, true); assert.deepEqual(ctx.shops, [], 'Revoked membership must never fall back');
  user = null; await assert.rejects(summary.getViewerContext(), /Not authenticated/);
  assert.equal(userChecks, 10, 'Every resolution revalidates the authenticated user');

  const pure = authLoad(path.join(root, 'src/lib/control/companyScope.ts'));
  assert.equal(pure.companyRequest('/dashboard', new URLSearchParams('company=' + B + '&shop=' + A)), B);
  assert.equal(pure.companyRequest('/shops/' + B, new URLSearchParams()), B);
  assert.equal(pure.companyRequest('/shops/new', new URLSearchParams()), '');
  assert.equal(pure.companyRequest('/dashboard', new URLSearchParams('company=' + A + '&company=' + B)), '__invalid_company__');
  assert.equal(pure.companyRequest('/dashboard', new URLSearchParams('company=' + encodeURIComponent('../unavailable'))), '__invalid_company__');
  assert.equal(pure.companyRequest('/dashboard', new URLSearchParams('shop_id=' + B)), B);
  assert.equal(pure.companyHref('/devices/device-a?q=old&before=cursor&shop=' + A, B, true), '/devices?company=' + B);
  assert.equal(pure.companyHref('/shops/' + A + '/devices?q=old', B, true), '/shops/' + B + '?company=' + B);
  assert.equal(new URL(pure.companyHref('/api/audit/export?shop_id=' + B, A), 'https://fixture.invalid').searchParams.get('shop_id'), A);
  assert.equal(pure.companyHref('https://example.invalid/', A), 'https://example.invalid/');
  assert.equal(pure.isPlatformPage('/software-updates', new URLSearchParams()), true);
  assert.equal(pure.isPlatformPage('/people', new URLSearchParams('tab=control')), true);
  assert.equal(pure.isPlatformPage('/devices', new URLSearchParams()), false);

  const db = database(seeds());
  let scoped = { userId: 'synthetic-viewer', email: 'reviewer@example.invalid', isPlatformAdmin: true, shops: [companies[0]], authorizedShops: companies, selectedCompanyId: A };
  const load = componentLoader({
    '@/lib/control/summary': { getViewerContext: async () => scoped, getShopSnapshot: async c => snapshot(c) },
    '@/lib/supabase/admin': { supabaseAdmin: () => db },
    '@/lib/billing/access': { describeShopAccess: () => snapshot(companies[0]).access },
    '@/lib/billing/entitlement': { getShopEntitlementFromRow: row => ({ status: row.billing_status || 'active' }) },
    '@/lib/billing/manual': { SHOP_BILLING_SELECT_COLUMNS: ['id','billing_status'], tryExtractMissingColumn: () => null },
  });
  const devices = load(path.join(root,'src/lib/control/deviceViews.ts'));
  const deviceData = await devices.loadDeviceViewRows();
  assert.deepEqual(deviceData.rows.map(row => row.id), ['device-a'], 'Company A survives >500 newer B rows');
  assertFilter(db.calls.find(c => c.table === 'rb_devices'), 'shop_id', [A]);
  for (const c of db.calls.filter(c => ['rb_device_tokens','rb_device_capability_snapshots'].includes(c.table))) assertFilter(c, 'device_id', ['device-a']);
  assert.equal((await devices.loadDeviceDetail('device-b-0')).device, null);

  const billing = load(path.join(root,'src/lib/control/billingViews.ts'));
  const billData = await billing.loadBillingViews(); assert.deepEqual(billData.rows.map(row => row.id), [A]); assert.equal(billData.summary.totalShops, 1);
  assertFilter(db.calls.find(c => c.table === 'rb_shops'), 'id', [A]);
  const people = load(path.join(root,'src/lib/control/peopleViews.ts'));
  let start = db.calls.length; const personData = await people.loadPeopleViews(); const personCalls = db.calls.slice(start);
  assert(personData.peopleRows.length > 0); assert(personData.peopleRows.every(row => row.shop_id === A));
  assert.equal(personData.summary.employees, 1); assert.equal(personData.summary.mobileEnabled, 1); assert.equal(personData.timeclockRows.length, 1);
  assert(!personCalls.some(c => c.table === 'rb_control_admins'), 'Company directory must not fetch global administrators');
  for (const table of ['employees','rb_shop_members','time_events']) assertFilter(personCalls.find(c => c.table === table), 'shop_id', [A]);
  assertFilter(personCalls.find(c => c.table === 'rb_profiles'), 'id', ['user-a']);
  const platformPeople = await people.loadPeopleViews({ platformAdminsOnly: true });
  assert(platformPeople.peopleRows.length > 0 && platformPeople.peopleRows.every(row => row.type === 'Control User'));

  const support = load(path.join(root,'src/lib/control/supportViews.ts'));
  start = db.calls.length; const supportData = await support.loadSupportViews(); const supportCalls = db.calls.slice(start);
  assert(supportData.bundles.every(row => row.shop_id === A)); assert(supportData.capabilityRows.every(row => row.shop_id === A)); assert(supportData.deleteOperations.every(row => row.shop_id === A));
  for (const table of ['rb_devices','rb_support_bundles','rb_delete_operations']) assertFilter(supportCalls.find(c => c.table === table && !c.head), 'shop_id', [A]);
  assertFilter(supportCalls.find(c => c.table === 'rb_device_capability_snapshots'), 'device_id', ['device-a']);
  assert(supportCalls.filter(c => c.head).length === 6, 'Only explicit global schema diagnostics use global head counts');
  const audit = load(path.join(root,'src/lib/control/auditViews.ts'));
  start = db.calls.length; const auditData = await audit.loadAuditViews({ action: '', actor_email: '', shop_id: B, target_id: '', before: '', limit: '200' });
  assert.equal(auditData.filters.shop_id, A); assert.equal(auditData.counts.totalVisible, 3); assert(auditData.rows.every(row => row.shop_id === A));
  for (const call of db.calls.slice(start)) assertFilter(call, 'shop_id', [A]);

  const extra = await require('./verify-control-company-scope-extra.js')({root,componentLoader,db,devices,people,pure,summary,context:scoped,companies,A,B,deviceData,personData,snapshot,assertFilter});
  scoped = { ...scoped, shops: [], selectedCompanyId: null, companyUnavailable: true };
  start = db.calls.length; assert.deepEqual((await devices.loadDeviceViewRows()).rows, []); assert.deepEqual((await billing.loadBillingViews()).rows, []); assert.deepEqual((await people.loadPeopleViews()).peopleRows, []);
  assert.deepEqual((await audit.loadAuditViews({ action: '', actor_email: '', shop_id: B, target_id: '', before: '', limit: '200' })).rows, []);
  assert.equal(db.calls.length, start, 'Unavailable company must make no company data queries');
  const emptySupport = await support.loadSupportViews();
  assert.deepEqual(emptySupport.bundles, []); assert.deepEqual(emptySupport.capabilityRows, []); assert.deepEqual(emptySupport.deleteOperations, []);
  assert(db.calls.slice(start).every(call => call.head), 'Unavailable company permits only labeled platform schema counts');
  return { extra, authResolutions: userChecks, unavailableFailClosed: true, noCrossCompanyRows: true, filterBeforeLimits: true, serverCalls: db.calls };
}
async function bundleClient() {
  const bundleDir = path.join(evidence, 'client'); fs.mkdirSync(bundleDir, {recursive: true});
  const tsLoader = path.join(bundleDir, 'transpile.cjs');
  fs.writeFileSync(tsLoader, 'const ts=require(' + JSON.stringify(requireRoot.resolve('typescript')) + ');module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText};');
  const navigationMock = path.join(bundleDir, 'navigation.cjs');
  fs.writeFileSync(navigationMock, 'exports.usePathname=()=>window.location.pathname;exports.useSearchParams=()=>new URLSearchParams(window.location.search);');
  const linkMock = path.join(bundleDir, 'link.cjs');
  fs.writeFileSync(linkMock, 'const React=require("react");module.exports=React.forwardRef(function Link({href,prefetch,replace,scroll,children,...props},ref){return React.createElement("a",{...props,href:typeof href==="string"?href:"/#unsupported",ref},children)});');
  const entry = path.join(bundleDir, 'entry.cjs');
  fs.writeFileSync(entry, [
    'const React=require("react");const {createRoot}=require("react-dom/client");',
    'const Shell=require(' + JSON.stringify(path.join(root,'src/components/control/ControlAppShell.tsx')) + ').default;',
    'const {CompanyForm}=require(' + JSON.stringify(path.join(root,'src/components/control/CompanyScope.tsx')) + ');',
    'const CompanyLink=require(' + JSON.stringify(path.join(root,'src/components/control/CompanyLink.tsx')) + ').default;',
    'const data=JSON.parse(document.getElementById("fixture-data").textContent);const h=React.createElement;',
    'const body=h("div",null,h("p",{role:"note"},"LOCAL SYNTHETIC COMPANY FIXTURE | NOT LIVE / AUTHENTICATED"),h("h1",null,"Company scope verification"),h("div",{"data-testid":"company-data"},data.record),h(CompanyLink,{href:"/devices/device-a?q=old"},"Open synthetic detail"),h(CompanyForm,{method:"get",action:"/devices"},h("label",null,"Filter query",h("input",{name:"q",defaultValue:new URLSearchParams(location.search).get("q")||""})),h("button",{type:"submit"},"Apply fixture filter")));',
    'createRoot(document.getElementById("root")).render(h(Shell,{email:"reviewer@example.invalid",roleLabel:"Platform admin",statuses:[],companies:data.companies,selectedCompanyId:data.selectedId,companyUnavailable:data.unavailable,companyError:data.error},body));'
  ].join('\n'));
  const webpack = requireRoot('next/dist/compiled/webpack/webpack').webpack;
  await new Promise((resolve,reject) => webpack.webpack({ mode:'production',devtool:false,cache:false,target:'web',entry,output:{path:bundleDir,filename:'fixture.js'},optimization:{minimize:false},resolve:{extensions:['.js','.cjs','.tsx','.ts','.json'],modules:[path.join(root,'node_modules'),'node_modules'],alias:{'@':path.join(root,'src')}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:[{loader:tsLoader}]}]},plugins:[new webpack.NormalModuleReplacementPlugin(/^next\/navigation$/,navigationMock),new webpack.NormalModuleReplacementPlugin(/^next\/link$/,linkMock)] }, (error,stats) => {
    if(error)return reject(error);
    if(stats.hasErrors())return reject(new Error(JSON.stringify(stats.toJson({all:false,errors:true}).errors)));
    return resolve();
  }));
  return path.join(bundleDir,'fixture.js');
}

async function browserChecks(pure) {
  const bundle = await bundleClient();
  let allowed = [...companies], delayB = false, releaseB;
  const pageRequests = [], external = [], errors = [], screenshots = [];
  const server = http.createServer(async (request,response) => {
    const url = new URL(request.url, 'http://fixture.invalid');
    if(url.pathname === '/fixture.js') { response.writeHead(200,{'Content-Type':'application/javascript'}); response.end(fs.readFileSync(bundle));return; }
    if(url.pathname === '/favicon.ico') {response.writeHead(204);response.end();return;}
    if(url.pathname.startsWith('/artwork/')) {
      const relative = path.posix.normalize(url.pathname).slice(1);const file=path.resolve(root,'public',relative);
      assert(file.startsWith(path.resolve(root,'public')+path.sep));
      if(!fs.existsSync(file)){response.writeHead(404);response.end();return;}
      response.writeHead(200,{'Content-Type':file.endsWith('.svg')?'image/svg+xml':'image/png'});response.end(fs.readFileSync(file));return;
    }
    pageRequests.push({path:url.pathname,search:url.search});
    const mode = url.searchParams.get('fixture');
    const available = mode === 'empty' || mode === 'error' ? [] : mode === 'single' ? [companies[0]] : allowed;
    const selected = pure.resolveCompany(available,pure.companyRequest(url.pathname,url.searchParams));
    const data={companies:available,selectedId:selected.selected?.id || null,unavailable:selected.unavailable,error:mode==='error'?'Synthetic company list unavailable.':null,record:selected.selected ? (selected.selected.id===A?'A-only synthetic record':'B-only synthetic record') : 'No company data'};
    if(delayB && selected.selected?.id===B) await new Promise(resolve=>{releaseB=resolve;});
    const payload=JSON.stringify(data).replaceAll('<','\\u003c');
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'none'; form-action 'self'"});
    response.end('<!doctype html><html><head><meta charset="utf-8"><title>Synthetic company fixture</title></head><body style="margin:0"><div id="root"></div><script type="application/json" id="fixture-data">'+payload+'</script><script defer src="/fixture.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const {chromium}=require(process.env.CONTROL_PLAYWRIGHT_CORE || 'C:\\RunBook-DeployPrep\\20261016-control\\browser-tools\\node_modules\\playwright-core');
  let browser;
  try {
    browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
    const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(external.push(route.request().url()),route.abort()));
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('response',response=>{if(response.status()>=400)errors.push(String(response.status())+': '+response.url());});
    const picker=()=>page.getByRole('combobox',{name:'Company',exact:true});
    async function expectCompany(id) {
      await picker().waitFor({state:'visible'});assert.equal(await picker().inputValue(),id);
      const text=await page.getByTestId('company-data').innerText();assert.equal(text,id===A?'A-only synthetic record':'B-only synthetic record');
      assert.equal(await page.locator('#control-navigation-search').count(),0,'Find Module is removed');
      const hrefs=await page.locator('.control-nav a').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
      assert.equal(hrefs.length,13);assert(hrefs.every(href=>new URL(href,origin).searchParams.get('company')===id));
    }
    async function shot(name){const file=path.join(evidence,name+'.png');await page.screenshot({path:file});screenshots.push(file);}    await page.goto(origin+'/dashboard?company='+A);await expectCompany(A);
    assert.deepEqual(await picker().locator('option').evaluateAll(options=>options.map(option=>option.value)),[A,B]);await shot('company-a-1366x768');
    // Synthetic DOM tampering proves the real handler rejects an ID outside its options.
    const beforeUnauthorized = pageRequests.length;
    await picker().evaluate((select, unauthorized) => { const option=document.createElement('option');option.value=unauthorized;option.textContent='Synthetic unauthorized';select.append(option);select.value=unauthorized;select.dispatchEvent(new Event('change',{bubbles:true}));option.remove(); }, C);
    assert.equal(pageRequests.length,beforeUnauthorized);await expectCompany(A);
    // Full-document navigation retires the old company component tree. While pending,
    // the native selector is disabled and the previous company's main content is hidden.
    delayB=true;const startRequests=pageRequests.length;
    const pending=await picker().evaluate((select,value)=>{
      select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));
      return {disabled:select.disabled,inert:Boolean(document.querySelector('.control-nav a').closest('[inert]')),visibility:getComputedStyle(document.querySelector('.control-main')).visibility,status:document.querySelector('[role="status"]')?.textContent};
    },B);
    console.log('Pending DOM:',JSON.stringify(pending));
    assert.equal(pending.disabled,true);assert.equal(pending.inert,true);assert.equal(pending.visibility,'hidden');assert.equal(pending.status,'Loading company...');
    while(!releaseB)await new Promise(resolve=>setTimeout(resolve,10));releaseB();delayB=false;
    await page.waitForURL(url=>url.searchParams.get('company')===B);await expectCompany(B);
    assert.equal(pageRequests.slice(startRequests).filter(request=>new URLSearchParams(request.search).get('company')===B).length,1,'Rapid input must not issue a second company navigation');
    await shot('company-b-1366x768');
    await picker().selectOption(A);await page.waitForURL(url=>url.searchParams.get('company')===A);await expectCompany(A);
    await page.goBack();await page.waitForURL(url=>url.searchParams.get('company')===B);await expectCompany(B);
    await page.goForward();await page.waitForURL(url=>url.searchParams.get('company')===A);await expectCompany(A);
    await page.reload();await expectCompany(A);
    await picker().focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    await page.waitForURL(url=>url.searchParams.get('company')===B);await expectCompany(B);
    await page.getByRole('link',{name:'Devices',exact:true}).click();await page.waitForURL(url=>url.pathname==='/devices');await expectCompany(B);
    await page.getByLabel('Filter query',{exact:true}).fill('synthetic-filter');
    await page.getByRole('button',{name:'Apply fixture filter',exact:true}).click();
    await page.waitForURL(url=>url.pathname==='/devices'&&url.searchParams.get('q')==='synthetic-filter');
    assert.equal(new URL(page.url()).searchParams.get('company'),B);await expectCompany(B);
    await page.getByRole('link',{name:'Open synthetic detail',exact:true}).click();await page.waitForURL(url=>url.pathname==='/devices/device-a');
    assert.equal(new URL(page.url()).searchParams.get('company'),B);
    await picker().selectOption(A);await page.waitForURL(url=>url.pathname==='/devices'&&url.searchParams.get('company')===A);await expectCompany(A);
    assert.equal(new URL(page.url()).searchParams.has('q'),false,'Old company filters/cursors are cleared on switch');
    await page.goto(origin+'/shops/'+A+'?tab=overview&company='+A);await expectCompany(A);
    await picker().selectOption(B);await page.waitForURL(url=>url.pathname==='/shops/'+B&&url.searchParams.get('company')===B);await expectCompany(B);
    await page.goto(origin+'/software-updates?company='+A);await expectCompany(A);
    assert.equal(await page.getByRole('note',{name:'Platform-wide page',exact:true}).count(),1);
    await page.goto(origin+'/dashboard?company='+A+'&fixture=single');await expectCompany(A);
    assert.deepEqual(await picker().locator('option').evaluateAll(options=>options.map(option=>option.value)),[A]);
    await page.goto(origin+'/dashboard?fixture=empty');await picker().waitFor({state:'visible'});
    assert.equal(await picker().isDisabled(),true);assert.equal(await page.getByTestId('company-data').innerText(),'No company data');await shot('company-empty-1366x768');
    await page.goto(origin+'/dashboard?company='+C);await picker().waitFor({state:'visible'});
    assert.equal(await picker().inputValue(),'');assert.equal(await page.getByTestId('company-data').innerText(),'No company data');
    assert.match(await picker().innerText(),/Choose another company/);await shot('company-unavailable-1366x768');
    allowed=[companies[1]];await page.goto(origin+'/dashboard?company='+A);await picker().waitFor({state:'visible'});
    assert.equal(await page.getByTestId('company-data').innerText(),'No company data','Revocation is rechecked on a fresh document request');
    assert.equal(await picker().inputValue(),'');await picker().selectOption(B);await page.waitForURL(url=>url.searchParams.get('company')===B);await expectCompany(B);allowed=[...companies];
    await page.goto(origin+'/dashboard?fixture=error');await picker().waitFor({state:'visible'});
    assert.equal(await picker().isDisabled(),true);assert.match(await page.getByRole('alert').innerText(),/Synthetic company list unavailable/);
    assert.equal(await page.getByTestId('company-data').innerText(),'No company data');await shot('company-error-1366x768');
    const beforeRetry=pageRequests.length;
    await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.getByRole('button',{name:'Retry companies',exact:true}).click()]);
    await picker().waitFor({state:'visible'});assert(pageRequests.length>beforeRetry,'Retry reloads company authority instead of fabricating options');
    assert.deepEqual(errors,[],'No client, resource or console errors');assert.deepEqual(external,[],'No provider or external requests');
    await context.close();
    return {actualReactComponents:true,syntheticServerBoundary:true,liveAuthenticatedApp:false,cases:['selection','unauthorized-option-rejection','keyboard','pending','rapid-input-lock','reload','back-forward','filter-GET','detail-switch','shop-switch','platform-note','single','empty','unavailable','revoked','error-retry'],pageRequests,screenshots,externalRequests:external,browserErrors:errors};
  } finally { if(releaseB)releaseB(); if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
}

async function main() {
  fs.mkdirSync(evidence,{recursive:true});const temp=path.join(evidence,'browser-temp');fs.mkdirSync(temp,{recursive:true});process.env.TEMP=temp;process.env.TMP=temp;
  const server=await serverChecks();
  const load=componentLoader({});const pure=load(path.join(root,'src/lib/control/companyScope.ts'));
  const browser=await browserChecks(pure);
  const sources=['src/lib/control/companyScope.ts','src/components/control/CompanyScope.tsx','src/components/control/CompanyLink.tsx','src/components/control/ControlAppShell.tsx','src/lib/control/summary.ts','src/lib/control/deviceViews.ts','src/lib/control/billingViews.ts','src/lib/control/peopleViews.ts','src/lib/control/supportViews.ts','src/lib/control/auditViews.ts'];
  const crypto=require('node:crypto');
  const sourceHashes=Object.fromEntries(sources.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  fs.writeFileSync(path.join(evidence,'company-scope-results.json'),JSON.stringify({generatedAt:new Date().toISOString(),label:'Synthetic actual-component and mocked-query evidence; not live/authenticated',sourceHashes,server,browser},null,2));
  console.log('PASS: company authority, scoped loaders before caps, actual React selection/keyboard/pending/history/filter/revocation/error behavior. Evidence: '+evidence);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});