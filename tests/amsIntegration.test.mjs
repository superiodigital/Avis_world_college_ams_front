import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { build } = createRequire(import.meta.resolve("vite/package.json"))("esbuild");
const storage = new Map();
beforeEach(() => {
  storage.clear();
  globalThis.window = new EventTarget();
  window.location = { origin: "http://front.test" };
  globalThis.sessionStorage = window.sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  globalThis.document = { cookie: "", querySelector: () => null };
  globalThis.__auth = { sessionToken: "backend-token", logout: () => { globalThis.__loggedOut++; } };
  globalThis.__loggedOut = 0;
  globalThis.__app = {};
});
async function load(source, realAuth = false) {
  const result = await build({
    absWorkingDir: root, stdin: { contents: source, resolveDir: root, loader: "ts" }, bundle: true, write: false,
    format: "cjs", platform: "node", tsconfig: "tsconfig.json", logLevel: "silent",
    define: { "import.meta.env": JSON.stringify({ VITE_BACKEND_BASE_URL: "http://api.test/api/" }) },
    plugins: [{ name: "ui-boundaries", setup(build) {
      build.onResolve({ filter: /ToastMessage/ }, () => ({ path: "toast", namespace: "fixture" }));
      if (!realAuth) build.onResolve({ filter: /useAuthStore/ }, () => ({ path: "auth", namespace: "fixture" }));
      if (realAuth) build.onResolve({ filter: /useAppStore/ }, () => ({ path: "app", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "toast"
        ? "export const toast = { error() {}, success() {}, info() {} };"
        : args.path === "auth" ? "export const useAuthStore = { getState: () => globalThis.__auth };"
          : "export const useAppStore = { setState: value => Object.assign(globalThis.__app, value) };", loader: "js" }));
    } }],
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const id = "507f1f77bcf86cd799439011";

test("selected intake fills all stored milestones and clears missing dates", async () => {
  const { intakeSchedule } = await load('export { intakeSchedule } from "./src/features/college/intakeSchedule";');
  assert.deepEqual(intakeSchedule({ name: "DBT2701", intakeMonth: "January",
    intakeDate: "2027-01-12T00:00:00.000Z", finalExamResultDate: "15/02/2028",
    confermentDate: "20 Mar 2028", completionDate: "2028-01-12" }), {
    intakeMonth: "January", intakeDate: "2027-01-12", finalExamResultDate: "2028-02-15",
    confermentDate: "2028-03-20", completionDate: "2028-01-12",
  });
  assert.deepEqual(intakeSchedule({ name: "Next", intakeMonth: "March" }), {
    intakeMonth: "March", intakeDate: "", finalExamResultDate: "", confermentDate: "", completionDate: "",
  });
  assert.equal(intakeSchedule({ commenceDate: "2027-03-01" }).intakeDate, "2027-03-01");
  assert.equal(intakeSchedule({ intakeDate: "invalid" }).intakeDate, "");
});

test("full history requests a bounded transaction page independently of payment records", async () => {
  const { getTransactionPage, getTransactionMethods } = await load('export { getTransactionPage, getTransactionMethods } from "./src/services/payments";');
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/options")) return json(["Cash", "NETS"]);
    assert.equal(parsed.pathname, "/api/admin/payments/transactions");
    assert.equal(parsed.searchParams.get("page"), "3");
    assert.equal(parsed.searchParams.get("limit"), "8");
    assert.equal(parsed.searchParams.get("status"), "Successful");
    return json({ data: [{ _id: "log-1", studentId: id, paymentId: id, studentName: "Ada", studentCode: "REAL-001", paidAmount: 25, splittedCommissionRep: 2, splittedCommissionAgent: 3,
      transactionStatus: "Successful", feeType: "application", receiptNo: "APP-001", paymentMethod: "Cash", date: "2026-11-21T09:00:00.000Z" }], pagination: { totalRecords: 81 } });
  };
  const result = await getTransactionPage({ page: 3, limit: 8, status: "Successful" });
  assert.equal(calls, 1);
  assert.equal(result.total, 81);
  assert.equal(result.records[0].rowNumber, 17);
  assert.equal(result.records[0].amount, 25);
  assert.equal(result.records[0].status, "Successful");
  assert.equal(result.records[0].feeCategory, "Application Fee");
  assert.equal(result.records[0].paymentId, id);
  assert.equal(result.records[0].studentId, id);
  assert.equal(result.records[0].receiptNo, "APP-001");
  assert.equal(result.records[0].repCommission, 2);
  assert.equal(result.records[0].agentCommission, 3);
  assert.deepEqual(await getTransactionMethods(), ["Cash", "NETS"]);
  assert.equal(calls, 2);
});

test("student registry requests one page with server filters instead of all types", async () => {
  const { getStudentRegistryPage, getStudentRegistryOptions } = await load('export { getStudentRegistryPage, getStudentRegistryOptions } from "./src/services/ams";');
  const calls = [];
  globalThis.fetch = async url => {
    const parsed = new URL(url); calls.push(parsed);
    if (parsed.pathname.endsWith("/options")) return json({ courses: ["Diploma"], intakes: ["November"], years: ["2026"] });
    assert.equal(parsed.pathname, "/api/admin/student-registry");
    assert.equal(parsed.searchParams.get("page"), "3");
    assert.equal(parsed.searchParams.get("studentType"), "Local");
    assert.equal(parsed.searchParams.get("search"), "Ada");
    return json({ data: [{ _id: id, name: "Ada", studentType: "Domestic", studentId: "REAL-001", studentImage: "https://files.test/student.png", intakeDate: "2026-11-01", course: { course: "Diploma", code: "D1" } }], pagination: { totalStudents: 205 } });
  };
  const result = await getStudentRegistryPage({ page: 3, limit: 8, studentType: "Local", search: "Ada" });
  assert.equal(calls.length, 1);
  assert.equal(result.total, 205);
  assert.equal(result.records[0].studentType, "Local");
  assert.equal(result.records[0].studentId, "REAL-001");
  assert.equal(result.records[0].avatar, "https://files.test/student.png");
  assert.equal(result.records[0].admissionDate, "2026-11-01");
  assert.equal(result.records[0].course, "Diploma");
  assert.equal(result.records[0].courseCode, "D1");
  const options = await getStudentRegistryOptions("Local");
  assert.deepEqual(options.years, ["2026"]);
  assert.equal(calls.length, 2);
});

test("payment table fetches just the requested page without downloading all history", async () => {
  const { getPaymentPage, getPaymentLedger } = await load('export { getPaymentPage, getPaymentLedger } from "./src/services/payments";');
  const calls = [];
  globalThis.fetch = async url => {
    const parsed = new URL(url); calls.push(parsed);
    if (parsed.pathname.endsWith("payment-history")) { assert.equal(parsed.searchParams.get("paymentId"), id); return json([]); }
    assert.equal(parsed.searchParams.get("page"), "3");
    assert.equal(parsed.searchParams.get("limit"), "8");
    assert.equal(parsed.searchParams.get("search"), "Ada");
    return json({ data: [{ _id: id, studentName: "Ada", totalFees: 100 }], pagination: { totalRecords: 205 } });
  };
  const result = await getPaymentPage({ page: 3, limit: 8, search: "Ada" });
  assert.equal(calls.length, 1);
  assert.equal(result.total, 205);
  assert.equal(result.records.length, 1);
  await getPaymentLedger(result.records[0]);
  assert.equal(calls.length, 2);
});

test("photo uploads decode locally and send only the actual backend request", async () => {
  const { saveProfile } = await load('export { saveProfile } from "./src/services/profile";');
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, `http://api.test/api/admin/avis-profile/${id}`);
    assert.ok(options.body instanceof FormData);
    const image = options.body.get("logo");
    assert.equal(image.type, "image/png");
    assert.equal(await image.text(), "test-image");
    return json({ success: true });
  };
  await saveProfile(id, { avatarUrl: "data:image/png;base64,dGVzdC1pbWFnZQ==" });
  assert.equal(calls, 1);
});

test("intake API normalizes numeric and missing years for search and edit forms", async () => {
  const { intakes } = await load('export { intakes } from "./src/services/ams";');
  globalThis.fetch = async () => json([
    { _id: id, name: "November intake", year: 2026, academicYear: 2026 },
    { _id: "other", name: "Undated", year: null },
    { _id: "deleted", year: 2025, isDeleted: true },
  ]);
  const rows = await intakes.list();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].year, "2026");
  assert.equal(rows[0].academicYear, "2026");
  assert.equal(rows[0].year.toLowerCase().includes("2026"), true);
  assert.equal(rows[1].year, "");
  assert.equal(rows[1].academicYear, "");
});

test("fresh database college lookup treats only 404 as empty and cannot create records through editing", async () => {
  const { findCollege, saveCollege } = await load('export { findCollege, saveCollege } from "./src/services/ams";');
  globalThis.fetch = async () => json({ message: "College not found" }, 404);
  assert.equal(await findCollege(), null);
  globalThis.fetch = async () => json({ message: "Server unavailable" }, 500);
  await assert.rejects(findCollege(), error => error.status === 500);
  globalThis.fetch = async () => { throw new Error("No creation request should be sent"); };
  await assert.rejects(saveCollege({ name: "Test College", email: "college@test.invalid", phone: "1234567890", place: "Kochi", currency: "INR", image: "" }), /Configure the college/);
});

test("HTTP client normalizes the backend origin and handles invalid login without expiring another session", async () => {
  const { apiClient } = await load('export { apiClient } from "./src/services/api/apiClient";');
  let request;
  globalThis.fetch = async (url, options) => { request = { url, options }; return json({ message: "Invalid credentials" }, 401); };
  await assert.rejects(apiClient.post("/api/admin/auth/login", { email: "user@test.invalid", password: "bad" }, { skipAuth: true }), error => error.status === 401);
  assert.equal(request.url, "http://api.test/api/admin/auth/login");
  assert.equal(request.options.credentials, "include");
  assert.equal(request.options.headers.get("Authorization"), null);
  assert.equal(globalThis.__loggedOut, 0);
});

test("authenticated requests use the JWT and reject 200 responses containing success:false", async () => {
  const { apiClient } = await load('export { apiClient } from "./src/services/api/apiClient";');
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.get("Authorization"), "Bearer backend-token");
    return json({ success: false, message: "Rejected" });
  };
  await assert.rejects(apiClient.post("/api/admin/add-student", {}), error => error.status === 422);
});

test("a late unauthorized response cannot sign out a newly established session", async () => {
  const { apiClient } = await load('export { apiClient } from "./src/services/api/apiClient";');
  let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const request = apiClient.get("/api/admin/college");
  globalThis.__auth.sessionToken = "new-session";
  finish(json({}, 401));
  await assert.rejects(request);
  assert.equal(globalThis.__loggedOut, 0);
});

test("student collection reads every page and all three backend student types", async () => {
  const { students } = await load('export { students } from "./src/services/ams";');
  const seen = [];
  globalThis.fetch = async url => {
    const u = new URL(url);
    if (u.pathname === "/api/admin/college") return json({ _id: id, name: "College" });
    const type = u.searchParams.get("studentType"), page = Number(u.searchParams.get("page"));
    seen.push(`${type}:${page}`);
    return json({ data: [{ _id: `${type}-${page}`, name: type, studentType: type, course: { course: "Real course", code: "C1" } }], pagination: { totalPages: type === "International" ? 2 : 1 } });
  };
  const rows = await students.list();
  assert.equal(rows.length, 4);
  assert.ok(seen.includes("International:2"));
  assert.ok(seen.includes("Domestic:1"));
  assert.ok(seen.includes("Overseas:1"));
  assert.equal(rows.find(s => s.name === "Domestic").studentType, "Local");
});

test("student enrollment resolves the actual course, fee scheme and college IDs", async () => {
  const { students } = await load('export { students } from "./src/services/ams";');
  let posted;
  globalThis.fetch = async (url, options) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("all-courses")) return json([{ _id: "course-id", course: "Real course", courseCode: "C1", courseType: "Diploma", feesTypes: [{ _id: "scheme-id", name: "Standard", totalFee: 100 }] }]);
    if (pathname.endsWith("representatives-list")) return json({ representatives: [] });
    if (pathname.endsWith("agents-list")) return json([]);
    if (pathname.endsWith("/college")) return json({ _id: id });
    if (pathname.endsWith("add-student")) { posted = JSON.parse(options.body); return json({ success: true }, 201); }
    throw new Error(`Unexpected request: ${pathname}`);
  };
  await students.save({ id: "draft", name: "Real student", studentType: "Local", course: "Real course", courseCode: "C1", coursePaymentScheme: "scheme-id", paymentMethod: "One Time Settlement" }, true);
  assert.equal(posted.course, "course-id");
  assert.equal(posted.paymentScheme, "scheme-id");
  assert.equal(posted.college, id);
  assert.equal(posted.studentType, "Domestic");
  assert.equal(posted.fullName, "Real student");
});

test("unsupported installment drafts cannot create a fabricated schedule", async () => {
  const { students } = await load('export { students } from "./src/services/ams";');
  globalThis.fetch = async () => json([]);
  await assert.rejects(students.save({ id: "draft", course: "", studentType: "Overseas", paymentMethod: "Installment" }, true), /installment count/i);
});

test("partial payments remain received transactions and missing fields never become demo identities", async () => {
  const { mapTransaction, mapPayment } = await load('export { mapTransaction, mapPayment } from "./src/services/payments";');
  assert.equal(mapTransaction({ _id: "log", status: "remaining", amountPaid: 50, receiptNo: "SERVER-R1" }).status, "Settled");
  const payment = mapPayment({ _id: "p", totalFees: 100, outstandingAmount: 25 });
  assert.equal(payment.student.name, "");
  assert.equal(payment.student.finNumber, "");
  assert.equal(payment.outstandingAmount, 25);
});

test("the API client can download a binary receipt", async () => {
  const { apiClient } = await load('export { apiClient } from "./src/services/api/apiClient";');
  globalThis.fetch = async () => new Response("%PDF-1.4", { headers: { "content-type": "application/pdf" } });
  const blob = await apiClient.get("/api/admin/payments/receipts/log/pdf", { responseType: "blob" });
  assert.equal(await blob.text(), "%PDF-1.4");
});

test("concurrent settlement clicks produce only one payment write", async () => {
  const { settlePaymentRecord } = await load('export { settlePaymentRecord } from "./src/features/payment/utils/paymentStorage";');
  let finish, writes = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === "PATCH") { writes++; return new Promise(resolve => { finish = resolve; }); }
    if (url.endsWith("/payment-history")) return json([]);
    return json({ _id: "payment-id", totalFees: 100, outstandingAmount: 50 });
  };
  const payload = { amount: 50, paymentMethod: "Cash", feeCategory: "Course Fee" };
  const first = settlePaymentRecord("payment-id", payload);
  const second = await settlePaymentRecord("payment-id", payload);
  assert.equal(second.success, false);
  assert.equal(writes, 1);
  finish(json({ success: true }));
  assert.equal((await first).success, true);
});

test("authentication starts signed out and establishes identity only after backend login", async () => {
  const { useAuthStore } = await load('export { useAuthStore } from "./src/store/useAuthStore";', true);
  assert.equal(useAuthStore.getState().isAuthenticated, false);
  const payload = Buffer.from(JSON.stringify({ adminId: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const token = `header.${payload}.signature`;
  globalThis.fetch = async url => url.endsWith("/login") ? json({ success: true, token }) : json({ admin: { _id: id, name: "Actual admin", email: "admin@test.invalid", type: "admin", address: {} } });
  const result = await useAuthStore.getState().login({ email: "admin@test.invalid", password: "password" });
  assert.equal(result.success, true);
  assert.equal(useAuthStore.getState().sessionToken, token);
  assert.equal(useAuthStore.getState().user.name, "Actual admin");
  assert.equal(globalThis.__app.adminProfile.email, "admin@test.invalid");
  useAuthStore.getState().logout();
  assert.equal(useAuthStore.getState().isAuthenticated, false);
  assert.equal(storage.has("ams_auth_session_token"), false);
});


test("finance detail queries request bounded pages scoped to the selected partner", async () => {
 const calls = [];
 globalThis.fetch = async url => { calls.push(new URL(url)); return json({data: [], total: 21, page: 2, limit: 8}); };
 const {getFinanceLedger, getFinancePartners, getPartnerApplications} = await load('export {getFinanceLedger, getFinancePartners, getPartnerApplications} from "./src/services/reports.ts";');
 await getFinanceLedger({page: 2, limit: 8, search: "Alice", sort: "date-desc"});
 await getFinancePartners({type: "Agent", page: 2, limit: 8});
 await getPartnerApplications({type: "Agent", partnerId: "507f1f77bcf86cd799439011", page: 2, limit: 8});
 assert.equal(calls.length, 3);
 assert.equal(calls[0].pathname, "/api/admin/reports/finance/ledger");
 assert.equal(calls[0].searchParams.get("page"), "2");
 assert.equal(calls[0].searchParams.get("search"), "Alice");
 assert.equal(calls[2].searchParams.get("partnerId"), "507f1f77bcf86cd799439011");
 assert.ok(calls.every(url => url.searchParams.get("limit") === "8"));
});


test("CP table requests one page and maps real totals and installment amounts", async () => {
 const calls = [];
 globalThis.fetch = async url => {calls.push(new URL(url)); return json({cases: [{paymentId: "p", installmentNo: 2, installmentAmount: 150, cpStatus: "Due"}], stats: {totalCPCases: 21, due: 3, totalCPPayable: 420}, pagination: {totalRecords: 21, totalPages: 3}});};
 const {getCpReport} = await load('export {getCpReport} from "./src/services/reports.ts";');
 const result = await getCpReport({page: 2, limit: 8, cpStatus: "CP Due", partner: "Agency"});
 assert.equal(calls.length, 1); assert.equal(calls[0].searchParams.get("page"), "2");
 assert.equal(calls[0].searchParams.get("partner"), "Agency");
 assert.equal(result.metrics.totalCases, 21); assert.equal(result.metrics.totalCpPayable, 420);
 assert.equal(result.rows[0].installmentAmount, 150); assert.equal(result.rows[0].cpStatus, "CP Due");
});
test("CP export explicitly downloads every filtered page", async () => {
 const calls = [];
 globalThis.fetch = async url => { const u = new URL(url); calls.push(u); return json({cases: [{paymentId: "p", installmentNo: Number(u.searchParams.get("page"))}], pagination: {totalRecords: 101, totalPages: 2}}); };
 const {getCpExport} = await load('export {getCpExport} from "./src/services/reports.ts";');
 const rows = await getCpExport({cpStatus: "CP Settled", partner: "Agency", search: "Alice"});
 assert.equal(rows.length, 2); assert.equal(calls.length, 2);
 assert.ok(calls.every(url => url.searchParams.get("partner") === "Agency" && url.searchParams.get("search") === "Alice"));
 assert.equal(calls[1].searchParams.get("page"), "2");
});


test("GET cache is short lived, cloned, and isolated by administrator session", async () => {
 const {apiClient} = await load('export {apiClient} from "./src/services/api/apiClient.ts";');
 let requests = 0; const now = Date.now;
 globalThis.fetch = async () => json({items: [++requests]});
 try {
  Date.now = () => 1000;
  const first = await apiClient.get("/cache", {deduplicate: true}); first.items.push(999);
  assert.deepEqual(await apiClient.get("/cache", {deduplicate: true}), {items: [1]});
  assert.equal(requests, 1);
  Date.now = () => 11001;
  assert.deepEqual(await apiClient.get("/cache", {deduplicate: true}), {items: [2]});
  globalThis.__auth.sessionToken = "another-session";
  assert.deepEqual(await apiClient.get("/cache", {deduplicate: true}), {items: [3]});
 } finally { Date.now = now; }
});
test("writes and explicit refresh invalidate cached reads including old in-flight results", async () => {
 const {apiClient, invalidateApiCache} = await load('export {apiClient} from "./src/services/api/apiClient.ts"; export {invalidateApiCache} from "./src/services/api/queryCache.ts";');
 let count = 0;
 globalThis.fetch = async () => json({version: ++count});
 await apiClient.get("/records", {deduplicate: true});
 await apiClient.post("/records", {name: "Updated"});
 assert.equal((await apiClient.get("/records", {deduplicate: true})).version, 3);
 invalidateApiCache();
 assert.equal((await apiClient.get("/records", {deduplicate: true})).version, 4);
 let complete;
 globalThis.fetch = () => new Promise(resolve => { complete = resolve; });
 const stale = apiClient.get("/slow", {deduplicate: true});
 await new Promise(resolve => setImmediate(resolve));
 invalidateApiCache(); complete(json({version: "old"})); await stale;
 globalThis.fetch = async () => json({version: "new"});
 assert.equal((await apiClient.get("/slow", {deduplicate: true})).version, "new");
});
test("cancelling one shared GET leaves other subscribers running", async () => {
 const {apiClient} = await load('export {apiClient} from "./src/services/api/apiClient.ts";');
 let complete, transport, requests = 0;
 globalThis.fetch = (_url, options) => {requests++; transport = options.signal; return new Promise(resolve => {complete = resolve;});};
 const a = new AbortController(), b = new AbortController();
 const first = apiClient.get("/shared", {deduplicate: true, signal: a.signal});
 const second = apiClient.get("/shared", {deduplicate: true, signal: b.signal});
 await new Promise(resolve => setImmediate(resolve));
 a.abort(); await assert.rejects(first, {name: "AbortError"});
 assert.equal(transport.aborted, false); assert.equal(requests, 1);
 complete(json({ok: true})); assert.deepEqual(await second, {ok: true});
});
test("last subscriber cancellation aborts fetch without turning into a timeout", async () => {
 const {apiClient} = await load('export {apiClient} from "./src/services/api/apiClient.ts";');
 let transport;
 globalThis.fetch = (_url, options) => { transport = options.signal; return new Promise((_resolve, reject) => transport.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))); };
 const controller = new AbortController();
 const request = apiClient.get("/cancelled", {deduplicate: true, signal: controller.signal});
 await new Promise(resolve => setImmediate(resolve)); controller.abort();
 await assert.rejects(request, {name: "AbortError"}); assert.equal(transport.aborted, true);
 const already = new AbortController(); already.abort();
 await assert.rejects(apiClient.get("/cancelled", {deduplicate: true, signal: already.signal}), {name: "AbortError"});
});
test("failed GETs are not cached and real timeouts remain visible", async () => {
 const {apiClient} = await load('export {apiClient} from "./src/services/api/apiClient.ts";');
 let count = 0;
 globalThis.fetch = async () => ++count === 1 ? json({message: "Unavailable"}, 503) : json({ok: true});
 await assert.rejects(apiClient.get("/retry", {deduplicate: true}));
 assert.deepEqual(await apiClient.get("/retry", {deduplicate: true}), {ok: true}); assert.equal(count, 2);
 globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
 await assert.rejects(apiClient.get("/timeout", {deduplicate: true, timeoutMs: 5}), error => error.isTimeout === true && error.status === 408);
});


test("session reset aborts pending reads and discards their cached data", async () => {
 const {apiClient, resetApiSession} = await load('export {apiClient} from "./src/services/api/apiClient.ts"; export {resetApiSession} from "./src/services/api/queryCache.ts";');
 let signal;
 globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {signal = options.signal; signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")));});
 const request = apiClient.get("/private", {deduplicate: true});
 await new Promise(resolve => setImmediate(resolve)); resetApiSession(null);
 await assert.rejects(request, {name: "AbortError"}); assert.equal(signal.aborted, true);
 globalThis.__auth.sessionToken = "new-session";
 globalThis.fetch = async () => json({owner: "new-session"});
 assert.deepEqual(await apiClient.get("/private", {deduplicate: true}), {owner: "new-session"});
});
test("successful writes notify mounted queries but failed writes do not", async () => {
 const {apiClient} = await load('export {apiClient} from "./src/services/api/apiClient.ts";');
 let events = 0; window.addEventListener("ams-api-invalidated", () => events++);
 globalThis.fetch = async () => json({success: true});
 await apiClient.patch("/records/one", {name: "Updated"}); assert.equal(events, 1);
 globalThis.fetch = async () => json({message: "Rejected"}, 400);
 await assert.rejects(apiClient.patch("/records/one", {name: "Invalid"})); assert.equal(events, 1);
});


test("shared sidebar geometry preserves approved ribbon coordinates across sizes and hover", async () => {
 const {createWaveSamples, updateWaveSamples} = await load('export {createWaveSamples, updateWaveSamples} from "./src/layouts/Sidebar/waveGeometry.ts";');
 for (const [width, height] of [[80, 140], [276, 175], [320, 220]]) {
  const samples = createWaveSamples(width, height);
  for (const time of [0, 1.25, 8]) for (const active of [false, true]) {
   const mouse = {active, x: width * 0.7, boost: 0.8}; updateWaveSamples(samples, width, time, mouse);
   for (const point of samples) {
    const u = point.x / width, distance = Math.abs(u - mouse.x / width);
    const primary = height * (0.58 - 0.26 * Math.exp(-Math.pow((u - 0.72) / 0.20, 2)) + 0.06 * Math.exp(-Math.pow((u - 0.20) / 0.16, 2)) - 0.08 * (u - 0.5))
     + 3.2 * Math.sin(2 * Math.PI * 0.75 * u - 1.15 * time) + 1.8 * Math.cos(2 * Math.PI * 1.35 * u + 0.85 * time) + Math.sin(2 * Math.PI * 0.4 * u - 0.45 * time)
     + (active ? Math.exp(-Math.pow(distance / 0.22, 2)) * -6 * mouse.boost : 0);
    const crossing = height * (0.42 + 0.22 * Math.exp(-Math.pow((u - 0.70) / 0.24, 2)) - 0.05 * Math.exp(-Math.pow((u - 0.22) / 0.18, 2)) + 0.12 * (u - 0.3))
     + 2.6 * Math.sin(2 * Math.PI * 0.85 * u + 1.05 * time) + 1.5 * Math.cos(2 * Math.PI * 1.45 * u - 0.75 * time)
     + (active ? Math.exp(-Math.pow(distance / 0.25, 2)) * 4 * mouse.boost : 0);
    assert.ok(Math.abs(point.primaryY - primary) < 1e-10); assert.ok(Math.abs(point.crossingY - crossing) < 1e-10);
   }
  }
 }
});
test("decorative motion stops offscreen, hidden or reduced and cleans up observers", async () => {
 const {observeAnimationActivity} = await load('export {observeAnimationActivity} from "./src/components/animations/animationActivity.ts";');
 const previous = globalThis.IntersectionObserver;
 const media = new EventTarget(); media.matches = false; window.matchMedia = () => media;
 globalThis.document = new EventTarget(); document.hidden = false;
 let intersection, disconnected = false;
 globalThis.IntersectionObserver = class {constructor(callback) {intersection = callback;} observe() {} disconnect() {disconnected = true;} };
 try {
  const changes = []; const stop = observeAnimationActivity({}, active => changes.push(active));
  assert.deepEqual(changes, [false]); intersection([{isIntersecting: true}]); assert.equal(changes.at(-1), true);
  document.hidden = true; document.dispatchEvent(new Event("visibilitychange")); assert.equal(changes.at(-1), false);
  document.hidden = false; document.dispatchEvent(new Event("visibilitychange")); assert.equal(changes.at(-1), true);
  media.matches = true; media.dispatchEvent(new Event("change")); assert.equal(changes.at(-1), false);
  media.matches = false; media.dispatchEvent(new Event("change")); assert.equal(changes.at(-1), true);
  intersection([{isIntersecting: false}]); assert.equal(changes.at(-1), false);
  stop(); assert.equal(disconnected, true); const count = changes.length;
  document.dispatchEvent(new Event("visibilitychange")); media.dispatchEvent(new Event("change")); assert.equal(changes.length, count);
 } finally {globalThis.IntersectionObserver = previous;}
});
test("motion visibility has a working fallback without IntersectionObserver", async () => {
 const {observeAnimationActivity} = await load('export {observeAnimationActivity} from "./src/components/animations/animationActivity.ts";');
 const previous = globalThis.IntersectionObserver; globalThis.IntersectionObserver = undefined;
 const media = new EventTarget(); media.matches = false; window.matchMedia = () => media;
 globalThis.document = new EventTarget(); document.hidden = false;
 try {const states = []; const stop = observeAnimationActivity({}, active => states.push(active)); assert.deepEqual(states, [true]); stop();}
 finally {globalThis.IntersectionObserver = previous;}
});


test("header uses bounded search and count endpoints instead of downloading rosters", async () => {
 const calls = []; globalThis.fetch = async url => {calls.push(new URL(url)); return json({items: [], counts: {Students: 0, Courses: 0, Staff: 1, Partners: 0}});};
 const {getHeaderSearch, getHeaderSummary} = await load('export {getHeaderSearch, getHeaderSummary} from "./src/services/header.ts";');
 await getHeaderSearch("Alice"); await getHeaderSummary();
 assert.equal(calls.length, 2); assert.equal(calls[0].pathname, "/api/admin/dashboard/header-search");
 assert.equal(calls[0].searchParams.get("limit"), "15"); assert.equal(calls[0].searchParams.get("search"), "Alice");
 assert.equal(calls[1].pathname, "/api/admin/dashboard/header-summary");
});


test("agent assignment uses the selected representative ID even when names repeat", async () => {
 const reps = [{_id: "507f1f77bcf86cd799439011", name: "Same Name", email: "one@example.invalid"}, {_id: "507f1f77bcf86cd799439012", name: "Same Name", email: "two@example.invalid"}];
 let saved;
 globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  if (path.endsWith("representatives-list")) return json({representatives: reps});
  if (path.endsWith("/college")) return json({_id: "507f1f77bcf86cd799439013", name: "College"});
  if (path.endsWith("add-agents")) {saved = JSON.parse(options.body); return json({_id: "agent-created"});}
  if (path.endsWith("agents-list")) return json([{_id: "agent-created", name: "Agent", representatives: [reps[1]]}]);
  throw Error("Unexpected path: " + path);
 };
 const {agents} = await load('export {agents} from "./src/services/ams.ts";');
 await agents.save({id: "new", name: "Agent", email: "agent@example.invalid", phone: "123", type: "", representative: "Same Name", representativeId: reps[1]._id, country: "India", status: "Active"}, true);
 assert.equal(saved.representative, reps[1]._id); assert.equal(saved.partnerType, undefined);
 const [agent] = await agents.list(); assert.equal(agent.representativeId, reps[1]._id); assert.equal(agent.representative, "Same Name");
});
test("a missing representative selection cannot silently become a different partner", async () => {
 globalThis.fetch = async url => {
  if (new URL(url).pathname.endsWith("representatives-list")) return json({representatives: [{_id: "507f1f77bcf86cd799439011", name: "Same Name"}]});
  throw Error("No mutation expected");
 };
 const {agents} = await load('export {agents} from "./src/services/ams.ts";');
 await assert.rejects(agents.save({id: "new", name: "Agent", representative: "Same Name", representativeId: "507f1f77bcf86cd799439012"}, true), /Select an existing representative/);
});


test("course creation preserves full duration and displays saved requirement text", async () => {
 const description = "Age: Minimum 21 years.\nAcademic: Bachelor degree.\nEnglish: Pass entrance test.";
 const duration = "6 months institutional training + 6 months industrial attachment";
 let payload;
 globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  if (path.endsWith("/college")) return json({_id: id, name: "College"});
  if (path.endsWith("add-course")) {payload = JSON.parse(options.body); return json({_id: id});}
  if (path.endsWith("all-courses")) return json([{_id: id, course: "Course", courseCode: "TEST", duration, applicationFees: 0, requirementDescription: description, requirements: []}]);
  throw Error("Unexpected request");
 };
 const {courses} = await load('export {courses} from "./src/services/ams.ts";');
 await courses.save({id: "new", title: "Course", code: "TEST", courseType: "Diploma", duration, applicationFee: "0", requirementDescription: description}, true);
 assert.equal(payload.duration, duration); assert.equal(payload.applicationFees, 0); assert.equal(payload.requirementDescription, description);
 const [course] = await courses.list(); assert.equal(course.requirements.length, 3); assert.equal(course.requirements[1].description, "Academic: Bachelor degree.");
});
test("course requirements retain legacy rows and allow clearing all criteria", async () => {
 const {courseRequirements} = await load('export {courseRequirements} from "./src/services/courseFields.ts";');
 const legacy = [{id: "legacy", description: "Existing criterion"}];
 assert.deepEqual(courseRequirements("", legacy), legacy); assert.deepEqual(courseRequirements(""), []);
 assert.equal(courseRequirements("Age 21", legacy).length, 2);
 assert.equal(courseRequirements(" Age 21 \r\n\r\n English test ")[1].description, "English test");
});
