import {courseRequirements} from "./courseFields";
import { saveProfile } from "./profile";
import { dataUrlToBlob } from "./api/dataUrl";
import { apiClient as api } from "./api/apiClient";
import { assetUrl } from "./api/config";
import { ApiError } from "./api/apiError";
import type { AgentItem } from "@/features/agents/types";
import type { RepresentativeItem } from "@/features/representatives/types";
import type { AdminRosterItem } from "@/features/admins/types";
import type { InstituteItem } from "@/features/institute/types";
import type { CourseCommissionConfig } from "@/features/courseCommission/types";
import type { CollegeCategory, CollegeCourse, CollegeIntake, CollegeStudent, CollegeDetails, CollegeOverseasRequest } from "@/features/college/types";

// Legacy AMS responses use both bare arrays and named envelopes.
export type Row = Record<string, any>;
export const idOf = (row: any): string => typeof row === "string" ? row : String(row?._id || row?.id || "");
export const textOf = (value: any): string => typeof value === "string" ? value : value?.name || value?.course || "";
export const amountOf = (value: any): number => Number(String(value ?? 0).replace(/[^\d.-]/g, "")) || 0;
export function rowsOf(response: any, ...keys: string[]): Row[] {
  if (Array.isArray(response)) return response;
  for (const key of [...keys, "data"]) if (Array.isArray(response?.[key])) return response[key];
  throw new Error("The server returned an unexpected list response.");
}
const active = (r: Row) => r.status === false || ["inactive", "suspended"].includes(String(r.status).toLowerCase()) ? "Inactive" : "Active";
const date = (v: any) => v ? String(v).slice(0, 10) : "";
const source = new Map<string, Row>();
if (typeof window !== "undefined") window.addEventListener("ams-session-ended", () => source.clear());
function keep<T>(kind: string, row: Row, value: T): T { source.set(`${kind}:${idOf(row)}`, row); return value; }
const original = (kind: string, id: string): Row => source.get(`${kind}:${id}`) || {};

export interface Repository<T extends { id: string }> {
  key: string;
  list(): Promise<T[]>;
  save(value: T, creating: boolean): Promise<void>;
  remove(id: string): Promise<void>;
}
async function listRequest(path: string, ...keys: string[]) {
  try { return rowsOf(await api.get(path, { deduplicate: true }), ...keys); }
  catch (error) {
    // Only these legacy list controllers use 404 to represent an empty collection.
    if (error instanceof ApiError && error.status === 404 &&
      ["/api/admin/agents-list", "/api/admin/representatives-list", "/api/admin/all-admins"].includes(path)) return [];
    throw error;
  }
}

export const mapAgent = (r: Row): AgentItem => keep("agents", r, {
  id: idOf(r), agentCode: r.agentCode || r.code || "", name: r.name || "", email: r.email || "", phone: r.phone || "",
  type: r.partnerType || "", representative: (r.representatives || []).map(textOf).filter(Boolean).join(", "),
  representativeId: idOf(Array.isArray(r.representatives) ? r.representatives[0] : r.representatives),
  country: r.address?.country || "", status: r.partnerStatus || active(r), avatarUrl: assetUrl(r.avatarUrl || r.profilePic || r.logo_name, "/uploads"),
  joinedDate: date(r.createdAt), agencyName: r.agencyName || r.applicantInformation?.nameOfBusiness || "", notes: r.notes || "",
});
export const mapRep = (r: Row): RepresentativeItem => keep("representatives", r, {
  id: idOf(r), repCode: r.repCode || r.code || "", name: r.name || "", email: r.email || "", phone: r.phone || "",
  country: r.address?.country || "", agentCount: r.agents?.length || 0, status: r.partnerStatus || active(r), avatarUrl: assetUrl(r.avatarUrl || r.logo_name, "/uploads"),
  joinedDate: date(r.createdAt), organization: r.organization || "", region: r.address?.state || "", notes: r.notes || "",
});
export const mapAdmin = (r: Row): AdminRosterItem => keep("admins", r, {
  id: idOf(r), employeeId: r.employeeId || "", name: r.name || "", role: r.type === "super-admin" ? "Super Admin" : r.type === "admin" ? "Admin" : r.type || "", email: r.email || "", phone: r.phone || "",
  avatarUrl: assetUrl(r.logo_name, "/uploads"), department: r.department || "", country: r.address?.country || "", city: r.address?.city || "",
  state: r.address?.state || "", accessLevel: r.type === "super-admin" ? "Full Access" : "Custom", status: active(r) === "Active" ? "Active" : "Suspended",
  lastActive: r.lastActive || "", joinedDate: date(r.createdAt), location: [r.address?.city, r.address?.country].filter(Boolean).join(", "),
  twoFactorEnabled: Boolean(r.twoFactorEnabled), permissionsCount: Object.values(r.accessPermissions || {}).reduce((total: number, actions) => total + (actions && typeof actions === "object" ? Object.values(actions as Row).filter(v => v === true).length : 0), 0) as number,
});
export const mapCourse = (r: Row): CollegeCourse => keep("courses", r, {
  id: idOf(r), code: r.courseCode || "", title: r.course || "", level: r.courseType || "", courseType: r.courseType,
  category: textOf(r.categoryId), department: r.department || "", duration: r.duration || "", seats: r.seats || 0, enrolled: r.students?.length || 0,
  fee: String(r.fees ?? ""), applicationFee: String(r.applicationFees ?? ""), status: active(r) as "Active", intakes: r.intakes || [],
  requirementDescription: courseRequirements(r.requirementDescription, r.requirements || []).map(row => row.description).join("\n"), requirements: courseRequirements(r.requirementDescription, r.requirements || []),
  feeBreakdownSchemes: (r.feesTypes || []).map((f: Row) => ({ ...f, id: idOf(f), assessmentFee: f.assessmentFee || 0, gstRate: f.gst && f.totalFee > f.gst ? f.gst / (f.totalFee - f.gst) : 0 })),
});
export const mapStudent = (r: Row): CollegeStudent => keep("students", r, {
  ...r, id: idOf(r), studentId: r.studentId || r.studentCode || r.studentNo || "", name: r.name || "", avatar: assetUrl(r.image || r.studentImage || r.profilePic),
  email: r.email || "", phone: r.phone || r.mobile || "", course: textOf(r.course), courseCode: r.course?.code || r.course?.courseCode || "",
  passportOrNric: r.passportOrNric || r.passport || r.nric || "",
  admissionDate: r.admissionDate || r.intakeDate || "",
  category: textOf(r.category), intake: r.intakeName || textOf(r.intake), status: r.studentStatus || r.status || "Enrolled", nationality: r.nationality || r.country || "",
  address: typeof r.address === "string" ? r.address : r.address?.address || "", country: r.country || r.address?.country || "",
  googleDriveLinks: (r.studentDocuments || r.documents || []).map((d: Row) => ({ id: idOf(d), title: d.name || d.type || "Document", url: d.url, category: d.type, addedDate: date(d.uploadedAt) })),
  joinedDate: date(r.enrollmentDate || r.createdAt || r.createAt), studentType: r.studentType === "Domestic" ? "Local" : r.studentType,
  passportNo: r.passport || "", finNumber: r.fin || "", dateOfBirth: date(r.dob), gender: r.sex || "",
  coursePaymentScheme: idOf(r.paymentScheme), agent: textOf(r.agent || r.agents), representative: textOf(r.representative),
  college: textOf(r.college), totalFees: r.totalFees || r.fees || r.totalCourseAmount || 0, pendingAmount: r.outstandingAmount,
  highestQualification: r.highestAcademicQualification || "", identityPassType: r.identityOrPassType || "", singaporePhone: r.singaporeContactNumber || "",
});

export async function getCollege(): Promise<CollegeDetails & { currency: string }> {
  const r = await api.get<Row>("/api/admin/college");
  source.set("college", r);
  return { id: idOf(r), name: r.name || "", image: assetUrl(r.logo_name || r.image, "/uploads"),
    place: r.place || [r.address?.state, r.address?.country].filter(Boolean).join(", "), phone: r.phone || "", email: r.email || "", currency: r.currency || "" };
}
export async function saveCollege(value: CollegeDetails) {
  const raw = source.get("college") || {};
  if (!value.id) throw new Error("Configure the college in the database before editing its details.");
  await api.put(`/api/admin/edit-college/${value.id}`, { name: value.name, phone: value.phone, email: value.email,
    currency: raw.currency || "SGD", state: raw.address?.state || "", country: raw.address?.country || "", place: value.place });
  if (value.image?.startsWith("data:")) {
    const form = new FormData(); const blob = dataUrlToBlob(value.image);
    form.append("logo", blob, "college.png");
    await api.put(`/api/admin/edit-college-logo/${value.id}`, form);
  }
}
export async function findCollege() {
  try { return await getCollege(); }
  catch (error) { if (error instanceof ApiError && error.status === 404) { source.delete("college"); return null; } throw error; }
}
async function collegeId() { return (await getCollege()).id!; }

export const representatives: Repository<RepresentativeItem> = {
  key: "representatives",
  list: async () => (await listRequest("/api/admin/representatives-list", "representatives")).map(mapRep),
  save: async (v, creating) => {
    const raw = original("representatives", v.id);
    const body = { organization: v.organization, notes: v.notes, avatarUrl: v.avatarUrl, partnerStatus: v.status, name: v.name, email: v.email, phone: v.phone, state: v.region || raw.address?.state || "", country: v.country,
      agents: (raw.agents || []).map(idOf), collegeId: creating ? await collegeId() : undefined };
    if (creating) await api.post("/api/admin/add-representatives", body);
    else await api.put(`/api/admin/edit-representatives/${v.id}`, body);
  },
  remove: async id => { await api.patch(`/api/admin/delete-rep/${id}`); },
};
export const agents: Repository<AgentItem> = {
  key: "agents", list: async () => (await listRequest("/api/admin/agents-list")).map(mapAgent),
  save: async (v, creating) => {
    const raw = original("agents", v.id);
    const reps = await representatives.list();
    const selection = v.representativeId || v.representative;
    const legacyMatches = v.representativeId ? [] : reps.filter(r => r.name === selection);
    const rep = reps.find(r => r.id === selection) || (legacyMatches.length === 1 ? legacyMatches[0] : undefined);
    if (selection && !rep) throw new Error("Select an existing representative.");
    const body = { partnerType: v.type || undefined, agencyName: v.agencyName, notes: v.notes, avatarUrl: v.avatarUrl, partnerStatus: v.status, fullName: v.name, name: v.name, email: v.email, phone: v.phone, country: v.country,
      state: raw.address?.state || "", city: raw.address?.city || "", representative: rep?.id || "none", colleges: await collegeId() };
    if (creating) await api.post("/api/admin/add-agents", body);
    else await api.put(`/api/admin/edit-agent/${v.id}`, body);
  },
  remove: async id => { await api.patch(`/api/admin/delete-agent/${id}`); },
};
export const admins: Repository<AdminRosterItem> = {
  key: "admins", list: async () => (await listRequest("/api/admin/all-admins", "admins")).map(mapAdmin),
  save: async (v, creating) => {
    if (creating && !v.password) throw new Error("A password is required to create an administrator.");
    const body = { _id: v.id, fullName: v.name, email: v.email, password: v.password || undefined, avatarUrl: v.avatarUrl, city: v.city || "", state: v.state || "", country: v.country };
    if (creating) await api.post("/api/admin/add-admin", body);
    else await saveProfile(v.id, { name: v.name, email: v.email, phone: v.phone, city: v.city, state: v.state, country: v.country, department: v.department, bio: v.bio, role: v.role === "Super Admin" ? "super-admin" : v.role === "Admin" ? "admin" : v.role, status: v.status.toLowerCase(), password: v.password, avatarUrl: v.avatarUrl });
  },
  remove: async id => { await api.patch(`/api/admin/delete-admin/${id}`); },
};
export const institutes: Repository<InstituteItem> = {
  key: "institutes",
  list: async () => (await listRequest("/api/institute/listInstitutes")).map(r => keep("institutes", r, {
    id: idOf(r), instituteCode: r.instituteCode || "", name: r.name || "", imageUrl: assetUrl(r.profilePic), email: r.email || "",
    contactNo: r.contactNo || "", country: r.country || "", address: r.address || "", googleLocation: r.googleLocation || "", status: r.status || "Active", createdAt: date(r.createdAt),
    category: r.category, website: r.website || "", establishedYear: r.establishedYear || "", studentCapacity: r.studentCapacity,
  })),
  save: async (v, creating) => {
    const body: Row = { name: v.name, email: v.email, contactNo: v.contactNo, country: v.country, address: v.address, googleLocation: v.googleLocation, status: v.status, category: v.category, website: v.website, establishedYear: v.establishedYear, studentCapacity: v.studentCapacity };
    let payload: Row | FormData = body;
    if (v.imageUrl?.startsWith("data:")) {
      const form = new FormData();
      for (const [key, value] of Object.entries(body)) if (value != null) form.append(key, String(value));
      const blob = dataUrlToBlob(v.imageUrl); form.append("profilePic", blob, "institute.png"); payload = form;
    }
    if (creating) await api.post("/api/institute/addInstitutes", payload);
    else await api.put(`/api/institute/updateInstitutes/${v.id}`, payload);
  },
  remove: async id => { await api.delete(`/api/institute/deleteInstitutes/${id}`); },
};
export const courses: Repository<CollegeCourse> = {
  key: "courses", list: async () => (await listRequest("/api/admin/all-courses")).filter(r => !r.isDeleted).map(mapCourse),
  save: async (v, creating) => {
    const body = { course: v.title, courseCode: v.code, courseType: (v.courseType || v.level) === "Postgraduate" ? "Post Graduation" : v.courseType || v.level, duration: v.duration.trim(),
      applicationFees: amountOf(v.applicationFee), requirementDescription: v.requirementDescription || "", college: await collegeId() };
    if (creating) await api.post("/api/admin/add-course", body);
    else await api.put(`/api/admin/edit-courses/${v.id}`, body);
  },
  remove: async id => { await api.patch(`/api/admin/delete-courses/${id}`); },
};
export const categories: Repository<CollegeCategory> = {
  key: "categories", list: async () => (await listRequest("/api/admin/categories")).map(r => ({ ...r, id: idOf(r), name: r.name || "", value: r.value || "" })),
  save: async (v, creating) => { const body = { name: v.name, value: v.value }; if (creating) await api.post("/api/admin/categories", body); else await api.put(`/api/admin/categories/${v.id}`, body); },
  remove: async id => { await api.delete(`/api/admin/categories/${id}`); },
};
export const intakes: Repository<CollegeIntake> = {
  key: "intakes", list: async () => (await listRequest("/api/admin/intakes", "intakes")).filter(r => !r.isDeleted).map(r => ({
    ...r, id: idOf(r), name: String(r.name ?? ""), intakeName: String(r.name ?? ""), intakeMonth: String(r.intake ?? ""),
    year: String(r.year ?? ""), academicYear: String(r.academicYear ?? ""), status: r.status || "incoming", timetables: r.timetables || [],
  })),
  save: async (v, creating) => {
    const body = { name: v.intakeName || v.name, intakeNames: [v.intakeName || v.name], intake: v.intakeMonth || "", intakeDate: v.intakeDate,
      completionDate: v.completionDate, finalExamResultDate: v.finalExamResultDate, confermentDate: v.confermentDate, year: v.year, status: v.status };
    if (creating) await api.post("/api/admin/intakes", body); else await api.put(`/api/admin/intakes/${v.id}`, body);
  },
  remove: async id => { await api.delete(`/api/admin/intakes/${id}`); },
};
export const commissions: Repository<CourseCommissionConfig> = {
  key: "commissions", list: async () => (await listRequest("/api/admin/commissions", "commissions")).map(r => ({
    id: idOf(r), courseId: idOf(r.course), courseName: r.course?.course || "", code: r.course?.courseCode || "", lastUpdated: date(r.updatedAt),
    commissionTypes: (r.types || []).map((t: Row) => ({ id: idOf(t), typeName: t.typeName,
      agentShare: { calcType: t.agentCommissionType === "percentage" ? "Percent (%)" : "Fixed ($)", value: t.agentValue },
      repShare: { calcType: t.repCommissionType === "percentage" ? "Percent (%)" : "Fixed ($)", value: t.repValue } })),
  })),
  save: async (v) => {
    const course = (await courses.list()).find(c => c.id === v.courseId || c.code === v.code);
    if (!course) throw new Error("Select an existing course before configuring commissions.");
    await api.post("/api/admin/commission", { courseId: course.id, types: v.commissionTypes.map(t => ({ typeName: t.typeName,
      agentType: t.agentShare.calcType === "Percent (%)" ? "percentage" : "amount", agentValue: t.agentShare.value,
      repType: t.repShare.calcType === "Percent (%)" ? "percentage" : "amount", repValue: t.repShare.value })) });
  },
  remove: async id => { await api.delete(`/api/admin/commission/${id}`); },
};

export const students: Repository<CollegeStudent> = {
  key: "students",
  list: async () => {
    const college = await collegeId();
    const groups = await Promise.all(["International", "Domestic", "Overseas"].map(async studentType => {
      const records: Row[] = [];
      let page = 1, totalPages = 1;
      do {
        const response = await api.get<Row>(`/api/admin/all-students/${college}`, { params: { studentType, page, limit: 100 } });
        records.push(...rowsOf(response)); totalPages = response.pagination?.totalPages || 1; page++;
      } while (page <= totalPages);
      return records;
    }));
    return groups.flat().map(mapStudent);
  },
  save: async (v, creating) => {
    const catalog = await courses.list();
    const course = catalog.find(c => c.id === v.course || c.title === v.course || c.code === v.courseCode);
    if (!course && v.studentType !== "Overseas") throw new Error("Select a course from the college course catalog.");
    const raw = original("students", v.id);
    if (creating && v.paymentMethod === "Installment") throw new Error("An installment count and due-date schedule are required. The approved form currently provides no schedule fields; use One Time Settlement until the schedule is configured.");
    const courseRaw = course ? original("courses", course.id) : {};
    const scheme = (courseRaw.feesTypes || []).find((f: Row) => idOf(f) === v.coursePaymentScheme || f.name === v.coursePaymentScheme || f.schemeCode === v.coursePaymentScheme);
    if (!scheme && v.studentType !== "Overseas") throw new Error("Select a payment scheme configured for this course.");
    const [repList, agentList] = await Promise.all([representatives.list(), agents.list()]);
    const body: Row = { ...raw, fullName: v.name, name: v.name, email: v.email, phone: v.phone, salutation: v.salutation,
      studentType: v.studentType === "Local" ? "Domestic" : v.studentType, documentType: v.idType?.toLowerCase() || raw.documentType,
      passport: v.passportNo, nric: v.nric, fin: v.finNumber, dob: v.dateOfBirth, country: v.country, nationality: v.nationality,
      college: await collegeId(), course: course?.id || raw.course, paymentScheme: scheme ? idOf(scheme) : raw.paymentScheme,
      courseType: v.courseType, representative: repList.find(r => r.id === v.representative || r.name === v.representative)?.id || "",
      agents: agentList.find(a => a.id === v.agent || a.name === v.agent)?.id || "", agent: agentList.find(a => a.id === v.agent || a.name === v.agent)?.id || "",
      intakeName: v.intakeName || v.intake, intake: v.intakeMonth, intakeDate: v.intakeDate, enrollmentDate: v.enrollmentDate,
      finalExamResultDate: v.finalExamResultDate, completionDate: v.completionDate, confermentDate: v.confermentDate,
      discount: amountOf(v.discount), totalCourseAmount: amountOf(v.totalCourseAmount ?? raw.totalCourseAmount ?? raw.totalFees ?? raw.fees), address: v.address,
      sex: v.gender || raw.sex, highestAcademicQualification: v.highestQualification || raw.highestAcademicQualification,
      studyMode: v.studyMode || raw.studyMode, peCourseTitle: v.peCourseTitle || raw.peCourseTitle, courseDeliveryMode: v.courseDeliveryMode || raw.courseDeliveryMode,
      installment: v.paymentMethod ? (v.paymentMethod === "Installment" ? "installment" : "one-time-settlement") : raw.installment || "one-time-settlement", tenureDate: raw.tenureDate || [v.intakeDate],
    };
    delete body._id; delete body.__v;
    let payload: Row | FormData = body;
    if (v.avatar?.startsWith("data:")) {
      const blob = dataUrlToBlob(v.avatar);
      const form = new FormData();
      for (const [key, value] of Object.entries(body)) {
        if (value == null) continue;
        if (Array.isArray(value)) value.forEach(item => form.append(key + "[]", String(item)));
        else if (typeof value !== "object") form.append(key, String(value));
      }
      form.append("studentImage", blob, "profile.png"); payload = form;
    }
    if (creating) await api.post("/api/admin/add-student", payload); else await api.put(`/api/admin/edit-student/${v.id}`, payload);
  },
  remove: async id => { await api.patch(`/api/admin/delete-student/${id}`); },
};

export interface StudentRegistryQuery {
  page: number; limit: number; studentType: string; search?: string; course?: string;
  intake?: string; status?: string; month?: string; year?: string; country?: string;
}
export async function getStudentRegistryPage(query: StudentRegistryQuery, signal?: AbortSignal) {
  const response = await api.get<Row>("/api/admin/student-registry", { params: { ...query }, signal, deduplicate: true });
  return { records: rowsOf(response).map(mapStudent), total: Number(response.pagination?.totalStudents || 0) };
}
export const getStudentRegistryOptions = (studentType: string, signal?: AbortSignal) => api.get<{ courses: string[]; intakes: string[]; years: string[] }>(
  "/api/admin/student-registry/options", { params: { studentType }, signal, deduplicate: true });

export function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const data = error.data as Row | undefined;
    if (error.status === 400 && Array.isArray(data?.errors)) return data.errors.map((entry: Row) => [entry.student || "", ...(Array.isArray(entry.errors) ? entry.errors : [entry.msg || "Validation failed"])].filter(Boolean).join(": ")).join("; ").slice(0, 800);
    if (error.status >= 400 && error.status < 500 && typeof (data?.message || data?.error) === "string") return data!.message || data!.error;
    return error.userMessage;
  }
  return error instanceof Error ? error.message : "Unable to complete the request.";
}

export const overseasRequests: Repository<CollegeOverseasRequest> = {
  key: "overseas-requests",
  list: async () => (await listRequest("/api/forms/overseas-student-application")).map(r => ({
    id: idOf(r), requestId: r.applicationNo || idOf(r), applicantName: r.fullName || "", avatar: assetUrl(r.studentImage),
    country: r.nationality || "", countryCode: "", passportNo: r.nationalIdNo || "", requestedCourse: r.courseApplied || "",
    requestedIntake: r.intake || "", submissionDate: r.applicationDate || date(r.createdAt),
    status: r.status === "Verified" ? "Documents Verified" : r.status === "Pending" ? "Pending Review" : r.status,
    documentsSubmitted: r.uploadedDocuments?.length || 0, documentsTotal: r.uploadedDocuments?.length || 0, email: r.email || "",
    documents: (r.uploadedDocuments || []).map((d: Row, index: number) => ({ id: idOf(d) || String(index), name: d.fileName || d.name || d.documentType || "Document", status: d.status || "Submitted", detail: d.fileUrl || "" })),
  })),
  save: async (v, creating) => {
    if (creating) throw new Error("Use the public overseas application form to create a request.");
    await api.put(`/api/forms/overseas-student-application/${v.id}`, { status: v.status === "Pending Review" ? "Pending" : v.status === "Documents Verified" ? "Verified" : v.status });
  },
  remove: async () => { throw new Error("Overseas application deletion is unavailable."); },
};
