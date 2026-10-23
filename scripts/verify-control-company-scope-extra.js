/* Synthetic query and actual-page regression checks. No live providers or application writes. */
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
function eqBeforeCap(call, column, value, cap) {
  assert(call, 'Missing recorded query');
  const predicate = call.operations.findIndex(op => op[0] === 'eq' && op[1] === column && op[2] === value);
  const limit = call.operations.findIndex(op => op[0] === 'limit' && op[1] === cap);
  assert(predicate >= 0 && limit > predicate, call.table + ': ' + column + ' predicate must precede limit(' + cap + ')');
}
module.exports = async function extraScopeChecks({ root, componentLoader, db, devices, people, pure, summary, context, companies, A, B, deviceData, personData, snapshot, assertFilter }) {
  const savedDevices = db.tables.rb_devices, savedTimes = db.tables.time_events;
  let workstationData, pendingData;
  const old = '2000-01-01T00:00:00.000Z', newer = '2026-10-23T00:00:00.000Z';
  try {
    const target = savedDevices.find(row => row.id === 'device-a');
    assert(target);
    db.tables.rb_devices = [
      ...Array.from({ length: 501 }, (_,i) => ({ ...target, id: 'newer-a-desktop-' + i, device_type: 'desktop', created_at: newer })),
      { ...target, device_type: 'workstation', created_at: old },
      ...savedDevices.filter(row => row.shop_id === B),
    ];
    let start = db.calls.length;
    workstationData = await devices.loadDeviceViewRows({ deviceType: 'workstation' });
    assert.deepEqual(workstationData.rows.map(row => row.id), ['device-a']);
    let call = db.calls.slice(start).find(call => call.table === 'rb_devices');
    assertFilter(call, 'shop_id', [A]); eqBeforeCap(call, 'device_type', 'workstation', 500);
    start = db.calls.length;
    const detail = await devices.loadDeviceDetail('device-a');
    assert.equal(detail.device?.id, 'device-a', 'Old company device detail must survive 501 newer same-company devices');
    call = db.calls.slice(start).find(call => call.table === 'rb_devices');
    assertFilter(call, 'shop_id', [A]); eqBeforeCap(call, 'id', 'device-a', 500);
    for (const auditCall of db.calls.slice(start).filter(call => call.table === 'rb_audit_log')) {
      eqBeforeCap(auditCall, 'target_id', 'device-a', 12); eqBeforeCap(auditCall, 'shop_id', A, 12);
    }
    start = db.calls.length;
    const contradictory = await devices.loadDeviceViewRows({ deviceId: 'device-a', deviceType: 'desktop' });
    assert.deepEqual(contradictory.rows, [], 'Device ID and type constraints use AND semantics');
    call = db.calls.slice(start).find(call => call.table === 'rb_devices');
    assertFilter(call, 'shop_id', [A]); eqBeforeCap(call, 'id', 'device-a', 500); eqBeforeCap(call, 'device_type', 'desktop', 500);
    assert.equal((await devices.loadDeviceDetail('device-b-0')).device, null, 'Explicit device ID cannot escape selected company');

    const timeA = savedTimes.find(row => row.shop_id === A), timeB = savedTimes.find(row => row.shop_id === B);
    assert(timeA && timeB);
    db.tables.time_events = [
      ...Array.from({ length: 1501 }, (_,i) => ({ ...timeA, id: 'settled-a-' + i, needs_review: false, updated_at: newer, server_ts: newer })),
      ...Array.from({ length: 1600 }, (_,i) => ({ ...timeB, id: 'pending-b-' + i, needs_review: true, updated_at: newer, server_ts: newer })),
      { ...timeA, needs_review: true, updated_at: old, server_ts: old, client_ts: old, created_at: old },
    ];
    start = db.calls.length;
    pendingData = await people.loadPeopleViews({ pendingReviewOnly: true });
    assert.deepEqual(pendingData.timeclockRows.map(row => row.id), [timeA.id]);
    assert.equal(pendingData.summary.reviewNeedsAttention, 1);
    call = db.calls.slice(start).find(call => call.table === 'time_events');
    assertFilter(call, 'shop_id', [A]); eqBeforeCap(call, 'needs_review', true, 1500);
    start = db.calls.length;
    const ordinaryPeople = await people.loadPeopleViews();
    call = db.calls.slice(start).find(call => call.table === 'time_events');
    assertFilter(call, 'shop_id', [A]);
    assert(!call.operations.some(op => op[0] === 'eq' && op[1] === 'needs_review'), 'Ordinary People/Mobile activity must not silently become pending-only');
    assert.deepEqual(ordinaryPeople.timeclockRows, [], 'The ordinary latest-event cap is intentionally distinct from queue-only reads');
  } finally { db.tables.rb_devices = savedDevices; db.tables.time_events = savedTimes; }

  // Actual async page rendering catches a second shop filter blanking otherwise scoped data.
  // CompanyScope is the real provider, so GET hidden fields and CompanyLinks are real too.
  const requireRoot = Module.createRequire(path.join(root, 'package.json'));
  const React = requireRoot('react');
  const { renderToStaticMarkup } = requireRoot('react-dom/server');
  const { navigationMocks } = require(path.join(root, 'scripts/verify-control-compact.js'));
  const pages = ['devices', 'workstations', 'people', 'mobile-access', 'timeclock-review', 'apps'];
  const pageEvidence = [];
  for (const name of pages) {
    const route = '/' + name;
    for (const hint of ['shop', 'shop_id']) {
      assert.equal(pure.companyRequest(route, new URLSearchParams({ company: A, [hint]: B })), A);
      const invalid = pure.resolveCompany(companies, pure.companyRequest(route, new URLSearchParams({ company: 'unavailable-company', [hint]: B })));
      assert.equal(invalid.unavailable, true); assert.equal(invalid.selected, null, 'Invalid canonical company must not fall back to accessible legacy hint');
    }
    const invocations = [];
    let snapshotCalls = 0;
    const load = componentLoader({
      ...navigationMocks(route, 'company=' + A),
      '@/lib/control/deviceViews': { loadDeviceViewRows: async options => { invocations.push({ loader: 'devices', options }); return name === 'workstations' ? workstationData : deviceData; } },
      '@/lib/control/peopleViews': { loadPeopleViews: async options => { invocations.push({ loader: 'people', options }); return name === 'timeclock-review' ? pendingData : personData; } },
      '@/lib/control/summary': { getViewerContext: async () => context, selectPrimaryShop: summary.selectPrimaryShop, getShopSnapshot: async company => { snapshotCalls++; return snapshot(company); } },
    });
    const Page = load(path.join(root, 'src/app/(authed)', name, 'page.tsx')).default;
    const Scope = load(path.join(root, 'src/components/control/CompanyScope.tsx')).default;
    async function render(params) {
      const element = await Page({ searchParams: Promise.resolve(params) });
      return renderToStaticMarkup(React.createElement(Scope, { companies, selectedId: A }, element));
    }
    const canonical = await render({ company: A });
    const stale = await render({ company: A, shop: B });
    assert.equal(stale, canonical, route + ': stale legacy shop must not filter away the canonical company');
    if (name === 'devices' || name === 'workstations') assert(canonical.includes('device-a'), route + ': require nonempty rendered device row');
    else if (name === 'apps') { assert(canonical.includes('Review devices')); assert.equal(snapshotCalls, 2, 'Both Apps renders must obtain selected-company snapshot'); }
    else assert(canonical.includes(companies.find(company => company.id === A).name), route + ': require nonempty rendered company row');
    if (name === 'workstations') assert(invocations.every(call => call.loader === 'devices' && call.options?.deviceType === 'workstation'));
    if (name === 'timeclock-review') assert(invocations.every(call => call.loader === 'people' && call.options?.pendingReviewOnly === true));
    if (name === 'people') assert(invocations.every(call => call.loader === 'people' && call.options?.platformAdminsOnly === false));
    pageEvidence.push({ route, nonemptyRenderedData: true, staleShopIgnored: true, loaderCalls: invocations });
  }
  return { sameCompanyDeviceIdBeforeCap: true, sameCompanyDeviceTypeBeforeCap: true, pendingReviewBeforeCap: true, ordinaryPeopleReadPreserved: true, actualPagePrecedence: pageEvidence };
};