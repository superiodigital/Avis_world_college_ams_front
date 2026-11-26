import { useAdmissionOptions } from "@/hooks/useAdmissionOptions";
import React, { useState, useMemo, useRef } from "react";
import { User, GraduationCap, CreditCard, Phone, Save, FileText, Mail, Calendar, Camera, Building, Upload, Trash2, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { FilterSelect, FilterSelectOption } from "@/components/ui/FilterSelect";
import { COURSE_TYPES, INTAKE_MONTHS } from "../AddStudentModal";
import countryData from "@/data/country.json";
import { CollegeStudent } from "../../types";
import { toast } from "@/components/common/ToastMessage";
import { validateFileUpload } from "@/lib/security";
import { cn } from "@/lib/utils";

interface CountryItem {
  name: string;
  code: string;
  nationality: string;
}

const SALUTATION_OPTIONS: FilterSelectOption[] = [
  { label: "Mr", value: "Mr" },
  { label: "MS", value: "MS" },
];

const GENDER_OPTIONS: FilterSelectOption[] = [
  { label: "Male", value: "Male", badgeDot: "bg-sky-500" },
  { label: "Female", value: "Female", badgeDot: "bg-rose-500" },
  { label: "Other", value: "Other", badgeDot: "bg-purple-500" },
];

const STUDENT_TYPE_OPTIONS: FilterSelectOption[] = [
  { label: "International", value: "International", badgeDot: "bg-blue-500", subLabel: "Overseas matriculant" },
  { label: "Local", value: "Local", badgeDot: "bg-emerald-500", subLabel: "Singapore Citizen / PR" },
  { label: "Overseas", value: "Overseas", badgeDot: "bg-purple-500", subLabel: "Offshore distance learner" },
];

const ID_TYPE_OPTIONS: FilterSelectOption[] = [
  { label: "Passport", value: "Passport" },
  { label: "NRIC", value: "NRIC" },
];

const RESIDENTIAL_STATUS_OPTIONS: FilterSelectOption[] = [
  { label: "Student Pass (STP)", value: "Student Pass" },
  { label: "Singapore Citizen (SC)", value: "Singapore Citizen" },
  { label: "Permanent Resident (SPR)", value: "Permanent Resident" },
  { label: "Employment Pass (EP)", value: "Employment Pass" },
  { label: "Dependent Pass (DP)", value: "Dependent Pass" },
  { label: "Long Term Visit Pass (LTVP)", value: "LTVP" },
  { label: "N/A", value: "N/A" },
];

const STUDY_MODE_OPTIONS: FilterSelectOption[] = [
  { label: "Full Time", value: "Full Time" },
  { label: "Part Time", value: "Part Time" },
  { label: "Distance Learning", value: "Distance Learning" },
  { label: "N/A", value: "N/A" },
];

const DELIVERY_MODE_OPTIONS: FilterSelectOption[] = [
  { label: "Face to Face Classroom", value: "Face to Face Classroom" },
  { label: "Blended Learning", value: "Blended Learning" },
  { label: "Online / E-Learning", value: "Online / E-Learning" },
  { label: "N/A", value: "N/A" },
];

const PASS_TYPE_OPTIONS: FilterSelectOption[] = [
  { label: "Student Pass (STP)", value: "Student Pass" },
  { label: "NRIC", value: "NRIC" },
  { label: "Employment Pass (EP)", value: "Employment Pass" },
  { label: "Dependent Pass (DP)", value: "Dependent Pass" },
  { label: "S Pass", value: "S Pass" },
  { label: "Training Work Permit", value: "Training Work Permit" },
  { label: "N/A", value: "N/A" },
];

const PAYMENT_METHOD_OPTIONS: FilterSelectOption[] = [
  { label: "One Time Settlement", value: "One Time Settlement" },
  { label: "Installment", value: "Installment" },
];

const PAYMENT_STATUS_OPTIONS: FilterSelectOption[] = [
  { label: "Pending", value: "pending", badgeDot: "bg-rose-500", subLabel: "Full fee balance outstanding" },
  { label: "Partial", value: "partial", badgeDot: "bg-amber-500", subLabel: "Partial fee payment logged" },
  { label: "Paid", value: "paid", badgeDot: "bg-emerald-500", subLabel: "Settled in full" },
];

const STUDENT_STATUS_OPTIONS: FilterSelectOption[] = [
  { label: "Enrolled", value: "Enrolled", badgeDot: "bg-emerald-500", subLabel: "Active & attending classes" },
  { label: "Approved", value: "Approved", badgeDot: "bg-sky-500", subLabel: "Admission granted, pending intake" },
  { label: "Reported", value: "Reported", badgeDot: "bg-purple-500", subLabel: "Reported to ICA / regulatory" },
  { label: "Rejected", value: "Rejected", badgeDot: "bg-rose-500", subLabel: "Admission or pass declined" },
];

export interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: CollegeStudent;
  onSave: (updatedStudent: CollegeStudent) => void | boolean | Promise<void | boolean>;
}

type EditTab = "personal" | "academic" | "passes" | "contact" | "financial";

export const EditStudentModal: React.FC<EditStudentModalProps> = ({ isOpen, onClose, student, onSave }) => {
  const [activeTab, setActiveTab] = useState<EditTab>("personal");
  const [formData, setFormData] = useState<CollegeStudent>({ ...student });
  const { COURSE_CATALOG, AGENTS_LIST, REPRESENTATIVES_LIST, paymentSchemeOptions: schemeOptions } = useAdmissionOptions(formData.course);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string>("");

  const handleChange = (field: keyof CollegeStudent, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-recalculate pending amount if totalFees or amountPaid changes
      if (field === "totalFees" || field === "amountPaid") {
        const total = parseFloat(String(field === "totalFees" ? value : updated.totalFees)) || 0;
        const paid = parseFloat(String(field === "amountPaid" ? value : updated.amountPaid)) || 0;
        updated.pendingAmount = Math.max(0, total - paid);
        if (paid >= total && total > 0) {
          updated.paymentStatus = "paid";
        } else if (paid > 0) {
          updated.paymentStatus = "partial";
        } else {
          updated.paymentStatus = "pending";
        }
      }
      return updated;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFileUpload(file, {
      maxSizeBytes: 2 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    });

    if (!validation.isValid) {
      setImageError(validation.error || "Invalid image file");
      toast.error(validation.error || "Failed to upload image");
      return;
    }

    setImageError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      handleChange("avatar", result);
      toast.success("Profile photo updated");
    };
    reader.readAsDataURL(file);
  };

  const courseTypeOptions = useMemo(() => {
    return COURSE_TYPES.map((type) => ({ label: type, value: type }));
  }, []);

  const courseOptions = useMemo(() => {
    const list: FilterSelectOption[] = COURSE_CATALOG.map((c) => ({
      label: `${c.title} (${c.code})`,
      value: c.title,
      subLabel: `${c.category} • ${c.defaultFee}`,
    }));
    if (formData.course && !list.some((c) => c.value.toLowerCase() === formData.course.toLowerCase())) {
      list.unshift({ label: formData.course, value: formData.course, subLabel: "Current enrolled course" });
    }
    return list;
  }, [formData.course, COURSE_CATALOG]);

  const paymentSchemeOptions = useMemo(() => {
    const list: FilterSelectOption[] = schemeOptions;
    if (formData.coursePaymentScheme && !list.some((s) => s.value.toLowerCase() === (formData.coursePaymentScheme || "").toLowerCase())) {
      list.unshift({ label: formData.coursePaymentScheme, value: formData.coursePaymentScheme });
    }
    return list;
  }, [formData.coursePaymentScheme, schemeOptions]);

  const intakeMonthOptions = useMemo(() => {
    return INTAKE_MONTHS.map((m) => ({ label: m, value: m }));
  }, []);

  const repOptions = useMemo(() => {
    const list: FilterSelectOption[] = [{ label: "NONE", value: "NONE" }, ...REPRESENTATIVES_LIST.map((rep) => ({ label: rep, value: rep }))];
    const rep = formData.representative;
    if (rep && !list.some((r) => r.value.toLowerCase() === rep.toLowerCase())) {
      list.unshift({ label: rep, value: rep });
    }
    return list;
  }, [formData.representative, REPRESENTATIVES_LIST]);

  const agentOptions = useMemo(() => {
    const list: FilterSelectOption[] = [
      { label: "Direct / No Agent", value: "Direct / No Agent" },

      ...AGENTS_LIST.map((ag) => ({ label: ag, value: ag })),
    ];
    const ag = formData.agent;
    if (ag && !list.some((a) => a.value.toLowerCase() === ag.toLowerCase())) {
      list.unshift({ label: ag, value: ag });
    }
    return list;
  }, [formData.agent, AGENTS_LIST]);

  const nationalityOptions = useMemo(() => {
    const list: FilterSelectOption[] = (countryData as CountryItem[]).map((c) => ({
      label: c.nationality || c.name,
      value: c.nationality || c.name,
      subLabel: `${c.code} • ${c.name}`,
    }));
    const nat = formData.nationality;
    if (nat && !list.some((n) => n.value.toLowerCase() === nat.toLowerCase())) {
      list.unshift({ label: nat, value: nat });
    }
    return list;
  }, [formData.nationality]);

  const countryOptions = useMemo(() => {
    const list: FilterSelectOption[] = (countryData as CountryItem[]).map((c) => ({
      label: c.name,
      value: c.name,
      subLabel: `${c.code} • ${c.nationality}`,
    }));
    const ctry = formData.country;
    if (ctry && !list.some((c) => c.value.toLowerCase() === ctry.toLowerCase())) {
      list.unshift({ label: ctry, value: ctry });
    }
    return list;
  }, [formData.country]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error("Student name cannot be empty");
      setActiveTab("personal");
      return;
    }

    const nowFormatted = new Date().toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const finalStudent: CollegeStudent = {
      ...formData,
      editedAt: nowFormatted,
    };

    if (await onSave(finalStudent) === false) return;
    toast.success("Student profile updated successfully");
    onClose();
  };

  const tabs: Array<{ id: EditTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "personal", label: "Personal Info", icon: User },
    { id: "academic", label: "Academic & Course", icon: GraduationCap },
    { id: "passes", label: "Passes & ID", icon: FileText },
    { id: "contact", label: "Contact & Agents", icon: Phone },
    { id: "financial", label: "Fees & Payment", icon: CreditCard },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Student Profile"
      subtitle={`Update enrollment dossier for ${student.name} (${student.studentId || "Student"})`}
      headerIcon={
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy-primary/10 text-burgundy-primary">
          <User className="h-5 w-5" />
        </div>
      }
      maxWidth="4xl"
    >
      <form
        onSubmit={handleSave}
        className="space-y-5"
      >
        {/* Tab navigation pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-brand-border pb-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
                  isActive ? "shadow-2xs bg-burgundy-primary text-white" : "text-text-secondary hover:bg-brand-bg hover:text-text-primary",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-white" : "text-text-muted")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Personal Info */}
        {activeTab === "personal" && (
          <div className="animate-in fade-in grid grid-cols-1 gap-4 duration-150 sm:grid-cols-2">
            {/* Profile Image Upload & Preview */}
            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-brand-border bg-brand-bg/30 p-3.5 sm:col-span-2 sm:flex-row sm:items-center">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-burgundy-primary/30 bg-brand-bg shadow-sm">
                {formData.avatar ? (
                  <img
                    src={formData.avatar}
                    alt={formData.name || "Student Avatar"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-burgundy-primary/40" />
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100"
                  title="Upload student photo"
                >
                  <Camera className="h-4 w-4 text-white" />
                </button>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    onChange={handleFileChange}
                    className="hidden"
                    id="edit-student-image-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5 rounded-lg border-brand-border text-xs font-semibold text-text-primary hover:bg-brand-bg"
                  >
                    <Upload className="h-3.5 w-3.5 text-burgundy-primary" />
                    <span>Upload Student Photo</span>
                  </Button>
                  {formData.avatar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleChange("avatar", "");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="gap-1 text-xs text-text-secondary hover:text-brand-red"
                      title="Remove uploaded photo"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove Photo</span>
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-text-muted">Allowed formats: JPG, PNG, WebP or SVG up to 2MB. Clear portrait recommended.</p>
                {imageError && (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-brand-red">
                    <AlertCircle className="h-3 w-3" />
                    {imageError}
                  </p>
                )}
              </div>
            </div>

            <div>
              <FilterSelect
                label="Salutation"
                value={formData.salutation || "Mr"}
                options={SALUTATION_OPTIONS}
                onChange={(val) => handleChange("salutation", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Full Name"
              required
              icon={User}
              value={formData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Vishnu Krishnakumar"
            />

            <Input
              label="Student ID"
              isMono
              value={formData.studentId || ""}
              onChange={(e) => handleChange("studentId", e.target.value)}
              placeholder="e.g. ATCG624/09/001"
            />

            <Input
              label="Date of Birth"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.dateOfBirth || ""}
              onChange={(e) => handleChange("dateOfBirth", e.target.value)}
            />

            <div>
              <FilterSelect
                label="Sex"
                value={formData.gender || "Male"}
                options={GENDER_OPTIONS}
                onChange={(val) => handleChange("gender", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <div>
              <FilterSelect
                label="Nationality"
                searchable
                searchPlaceholder="Search country or nationality..."
                value={formData.nationality || ""}
                options={nationalityOptions}
                onChange={(val) => handleChange("nationality", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <div>
              <FilterSelect
                label="Country"
                searchable
                searchPlaceholder="Search 240+ countries..."
                value={formData.country || ""}
                options={countryOptions}
                onChange={(val) => handleChange("country", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <div>
              <FilterSelect
                label="Student Type"
                value={formData.studentType || "International"}
                options={STUDENT_TYPE_OPTIONS}
                onChange={(val) => handleChange("studentType", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <div>
              <FilterSelect
                label="Residential Status"
                value={formData.residentialStatus || "N/A"}
                options={RESIDENTIAL_STATUS_OPTIONS}
                onChange={(val) => handleChange("residentialStatus", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Avatar Image URL (Alternative)"
              type="url"
              icon={Camera}
              value={formData.avatar || ""}
              onChange={(e) => handleChange("avatar", e.target.value)}
              placeholder="https://..."
            />

            <div className="sm:col-span-2">
              <Textarea
                label="Address"
                rows={2}
                value={formData.address || ""}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Enter student residential address..."
              />
            </div>
          </div>
        )}

        {/* Tab 2: Academic & Course */}
        {activeTab === "academic" && (
          <div className="animate-in fade-in grid grid-cols-1 gap-4 duration-150 sm:grid-cols-2">
            <Input
              label="College"
              icon={Building}
              value={formData.college || "Acetek College"}
              onChange={(e) => handleChange("college", e.target.value)}
              placeholder="e.g. Acetek College"
            />

            <div>
              <FilterSelect
                label="Course Type"
                value={formData.courseType || "Higher Diploma"}
                options={courseTypeOptions}
                onChange={(val) => handleChange("courseType", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <div className="sm:col-span-2">
              <FilterSelect
                label="Course"
                searchable
                searchPlaceholder="Search academic courses..."
                value={formData.course || "HIGHER DIPLOMA IN IT"}
                options={courseOptions}
                onChange={(val) => {
                  handleChange("course", val);
                  const found = COURSE_CATALOG.find((c) => c.title === val);
                  if (found) {
                    handleChange("courseCode", found.code);
                    handleChange("category", found.category);
                    if (found.level) handleChange("courseType", found.level);
                  }
                }}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <div className="sm:col-span-2">
              <FilterSelect
                label="Course Payment Scheme"
                value={formData.coursePaymentScheme || "Standard Scheme (Full Tuition)"}
                options={paymentSchemeOptions}
                onChange={(val) => handleChange("coursePaymentScheme", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Intake Name"
              isMono
              value={formData.intakeName || "HDIT2601"}
              onChange={(e) => handleChange("intakeName", e.target.value)}
              placeholder="e.g. HDIT2601"
            />

            <div>
              <FilterSelect
                label="Intake"
                searchable
                searchPlaceholder="Search month..."
                value={formData.intake || "January"}
                options={intakeMonthOptions}
                onChange={(val) => handleChange("intake", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Intake Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.intakeDate || "05/01/2026"}
              onChange={(e) => handleChange("intakeDate", e.target.value)}
            />

            <Input
              label="Enrollment Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.enrollmentDate || "15/02/2026"}
              onChange={(e) => handleChange("enrollmentDate", e.target.value)}
            />

            <Input
              label="Course Commencement Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.commencementDate || "05/01/2026"}
              onChange={(e) => handleChange("commencementDate", e.target.value)}
            />

            <Input
              label="Completion Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.completionDate || "05/06/2026"}
              onChange={(e) => handleChange("completionDate", e.target.value)}
            />

            <Input
              label="Final Exam Result Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.finalExamResultDate || "07/06/2026"}
              onChange={(e) => handleChange("finalExamResultDate", e.target.value)}
            />

            <Input
              label="Conferment Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.confermentDate || "07/06/2026"}
              onChange={(e) => handleChange("confermentDate", e.target.value)}
            />

            <Input
              label="Application Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.applicationDate || ""}
              onChange={(e) => handleChange("applicationDate", e.target.value)}
            />

            <Input
              label="Class"
              value={formData.class || "N/A"}
              onChange={(e) => handleChange("class", e.target.value)}
            />

            <div>
              <FilterSelect
                label="Study Mode"
                value={formData.studyMode || "N/A"}
                options={STUDY_MODE_OPTIONS}
                onChange={(val) => handleChange("studyMode", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <div>
              <FilterSelect
                label="Course Delivery Mode"
                value={formData.courseDeliveryMode || "N/A"}
                options={DELIVERY_MODE_OPTIONS}
                onChange={(val) => handleChange("courseDeliveryMode", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Highest Academic Qualification"
              value={formData.highestQualification || "OTHER POST-SECONDARY CERTIFICATES"}
              onChange={(e) => handleChange("highestQualification", e.target.value)}
            />

            <Input
              label="PE Course Title"
              value={formData.peCourseTitle || "Diploma in Culinary and Baking"}
              onChange={(e) => handleChange("peCourseTitle", e.target.value)}
            />
          </div>
        )}

        {/* Tab 3: Passes & ID */}
        {activeTab === "passes" && (
          <div className="animate-in fade-in grid grid-cols-1 gap-4 duration-150 sm:grid-cols-2">
            <div>
              <FilterSelect
                label="Choose an ID"
                value={formData.idType || "Passport"}
                options={ID_TYPE_OPTIONS}
                onChange={(val) => handleChange("idType", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label={`${formData.idType || "Passport"} Number`}
              isMono
              icon={FileText}
              value={formData.idNumber || formData.passportNo || formData.passportOrNric || ""}
              onChange={(e) => {
                const val = e.target.value;
                handleChange("idNumber", val);
                handleChange("passportNo", val);
                handleChange("passportOrNric", val);
              }}
              placeholder={formData.idType === "NRIC" ? "e.g. S9812345Z" : "e.g. MDFJHFCVFC"}
            />

            <Input
              label="FIN Number"
              isMono
              value={formData.finNumber || ""}
              onChange={(e) => handleChange("finNumber", e.target.value)}
              placeholder="e.g. MERDFFB"
            />

            <Input
              label="New Passport"
              isMono
              value={formData.newPassport || "N/A"}
              onChange={(e) => handleChange("newPassport", e.target.value)}
            />

            <div>
              <FilterSelect
                label="Identity / Pass Type"
                value={formData.identityPassType || "N/A"}
                options={PASS_TYPE_OPTIONS}
                onChange={(val) => handleChange("identityPassType", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Student Pass Exp Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.studentPassExpDate || ""}
              onChange={(e) => handleChange("studentPassExpDate", e.target.value)}
            />

            <Input
              label="Student Pass Collection Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.studentPassCollectionDate || ""}
              onChange={(e) => handleChange("studentPassCollectionDate", e.target.value)}
            />

            <Input
              label="Passport Exp Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.passportExpDate || ""}
              onChange={(e) => handleChange("passportExpDate", e.target.value)}
            />

            <Input
              label="Embarkment Card Exp Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.embarkmentCardExpDate || ""}
              onChange={(e) => handleChange("embarkmentCardExpDate", e.target.value)}
            />
          </div>
        )}

        {/* Tab 4: Contact & Agents */}
        {activeTab === "contact" && (
          <div className="animate-in fade-in grid grid-cols-1 gap-4 duration-150 sm:grid-cols-2">
            <Input
              label="Email Address"
              type="email"
              required
              icon={Mail}
              value={formData.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="student@example.com"
            />

            <Input
              label="Singapore Phone Number"
              type="tel"
              isMono
              icon={Phone}
              value={formData.singaporePhone || formData.phone || ""}
              onChange={(e) => {
                handleChange("singaporePhone", e.target.value);
                handleChange("phone", e.target.value);
              }}
              placeholder="91234567"
            />

            <Input
              label="Mobile"
              type="tel"
              isMono
              icon={Phone}
              value={formData.mobile || "N/A"}
              onChange={(e) => handleChange("mobile", e.target.value)}
            />

            <div>
              <FilterSelect
                label="Agents"
                searchable
                searchPlaceholder="Search partner agent..."
                value={formData.agent || "TEMP AGENT"}
                options={agentOptions}
                onChange={(val) => handleChange("agent", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <div>
              <FilterSelect
                label="Representative"
                searchable
                searchPlaceholder="Search representative..."
                value={formData.representative || "NONE"}
                options={repOptions}
                onChange={(val) => handleChange("representative", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Guardian Name"
              icon={User}
              value={formData.guardianName || "none"}
              onChange={(e) => handleChange("guardianName", e.target.value)}
            />

            <Input
              label="Guardian NRIC"
              isMono
              value={formData.guardianNric || ""}
              onChange={(e) => handleChange("guardianNric", e.target.value)}
              placeholder="Leave blank or N/A"
            />
          </div>
        )}

        {/* Tab 5: Fees & Payment */}
        {activeTab === "financial" && (
          <div className="animate-in fade-in grid grid-cols-1 gap-4 duration-150 sm:grid-cols-2">
            <div>
              <FilterSelect
                label="Payment"
                value={formData.paymentMethod || "One Time Settlement"}
                options={PAYMENT_METHOD_OPTIONS}
                onChange={(val) => handleChange("paymentMethod", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Discount"
              value={formData.discount || ""}
              onChange={(e) => handleChange("discount", e.target.value)}
              placeholder="e.g. 10% or $500"
            />

            <Input
              label="Due Date"
              type="date"
              formatAsDate
              icon={Calendar}
              value={formData.admissionDate || formData.enrollmentDate || "15/02/2026"}
              onChange={(e) => handleChange("admissionDate", e.target.value)}
            />

            <div>
              <FilterSelect
                label="Payment Status"
                value={formData.paymentStatus || "pending"}
                options={PAYMENT_STATUS_OPTIONS}
                onChange={(val) => handleChange("paymentStatus", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Total Fees (SGD)"
              type="number"
              step="0.01"
              min="0"
              prefix="$"
              isMono
              value={formData.totalFees ?? 2583.3}
              onChange={(e) => handleChange("totalFees", parseFloat(e.target.value) || 0)}
            />

            <Input
              label="Amount Paid (SGD)"
              type="number"
              step="0.01"
              min="0"
              prefix="$"
              isMono
              value={formData.amountPaid ?? 0}
              onChange={(e) => handleChange("amountPaid", parseFloat(e.target.value) || 0)}
            />

            <Input
              label="Pending Amount (SGD)"
              type="number"
              step="0.01"
              min="0"
              prefix="$"
              isMono
              disabled
              value={formData.pendingAmount ?? 2583.3}
              helperText="Auto-computed based on total fees minus paid amount"
            />

            <div>
              <FilterSelect
                label="Student Status (as of 31 Dec)"
                value={formData.status || "Enrolled"}
                options={STUDENT_STATUS_OPTIONS}
                onChange={(val) => handleChange("status", val)}
                buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                menuClassName="w-full min-w-full max-w-none"
              />
            </div>

            <Input
              label="Attendance Count"
              suffix="%"
              isMono
              value={String(formData.attendanceCount || "92%").replace("%", "")}
              onChange={(e) => handleChange("attendanceCount", `${e.target.value}%`)}
              placeholder="e.g. 92"
            />

            <Input
              label="Leave Count"
              suffix="Days"
              isMono
              value={String(formData.leaveCount || "3 Days").replace(/[^0-9]/g, "")}
              onChange={(e) => handleChange("leaveCount", `${e.target.value} Days`)}
              placeholder="e.g. 3"
            />

            <Input
              label="Performance Count"
              suffix="%"
              isMono
              value={String(formData.performanceCount || "88.5%").replace("%", "")}
              onChange={(e) => handleChange("performanceCount", `${e.target.value}%`)}
              placeholder="e.g. 88.5"
            />
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
                         className="gap-1.5 bg-burgundy-hover text-xs font-semibold text-white shadow-md shadow-burgundy-hover/20 hover:bg-burgundy-light"

          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
