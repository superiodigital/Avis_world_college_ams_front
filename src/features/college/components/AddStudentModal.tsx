import { intakeSchedule } from "../intakeSchedule";
import { useAdmissionOptions } from "@/hooks/useAdmissionOptions";
import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  User,
  GraduationCap,
  Users,
  CalendarRange,
  CreditCard,
  MapPin,
  Upload,
  Camera,
  Trash2,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Mail,
  Phone,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FilterSelect, FilterSelectOption } from "@/components/ui/FilterSelect";
import { CollegeStudent } from "../types";
import { validateFileUpload, sanitizeInput } from "@/lib/security";
import countryData from "@/data/country.json";

export interface CountryItem {
  name: string;
  code: string;
  nationality: string;
}

export interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStudent: (student: CollegeStudent) => void | boolean | Promise<void | boolean>;
  fullScreen?: boolean;
}

// Available Course Types as specified
export const COURSE_TYPES = ["Post Graduation", "Higher Diploma", "Diploma", "Certificate"] as const;

// Structured Course Catalog by Course Type
export interface CourseCatalogItem {
  id: string;
  code: string;
  title: string;
  level: (typeof COURSE_TYPES)[number];
  category: string;
  defaultFee: string;
}

// Intake Months
export const INTAKE_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatDisplayDate = (isoDate: string): string => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onAddStudent, fullScreen = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields State
  // 1. Personal Information
  const [studentImage, setStudentImage] = useState<string>("");
  const [salutation, setSalutation] = useState<"Mr" | "MS">("Mr");
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [studentType, setStudentType] = useState<"International" | "Local" | "Overseas">("International");
  const [finNumber, setFinNumber] = useState<string>("");
  const [idType, setIdType] = useState<"NRIC" | "Passport">("Passport");
  const [idNumber, setIdNumber] = useState<string>("");
  const [dateOfBirth, setDateOfBirth] = useState<string>("");

  // 2. Education Information
  const [courseType, setCourseType] = useState<(typeof COURSE_TYPES)[number]>("Post Graduation");
  const [courseTitle, setCourseTitle] = useState<string>("");
  const { COURSE_CATALOG, PAYMENT_SCHEMES, AGENTS_LIST, REPRESENTATIVES_LIST, INTAKE_NAMES, intakeRows, paymentSchemeOptions, schemes, selectedCourseType, loading: optionsLoading, error: optionsError } = useAdmissionOptions(courseTitle);
  const [coursePaymentScheme, setCoursePaymentScheme] = useState<string>(PAYMENT_SCHEMES[0] || "");

  // 3. Agents and Representatives
  const [agent, setAgent] = useState<string>(AGENTS_LIST[0] || "");
  const [representative, setRepresentative] = useState<string>(REPRESENTATIVES_LIST[0] || "");

  // 4. Intake Information
  const [intakeName, setIntakeName] = useState<string>(INTAKE_NAMES[0] || "");
  const [intakeMonth, setIntakeMonth] = useState<string>("January");
  const [intakeDate, setIntakeDate] = useState<string>("");
  const [finalExamResultDate, setFinalExamResultDate] = useState<string>("");
  const [confermentDate, setConfermentDate] = useState<string>("");
  const [completionDate, setCompletionDate] = useState<string>("");
  const [enrollmentDate, setEnrollmentDate] = useState<string>("");

  useEffect(() => {
    const selected = intakeRows.find(row => row.name === intakeName);
    const schedule = intakeSchedule(selected);
    setIntakeMonth(schedule.intakeMonth);
    setIntakeDate(schedule.intakeDate);
    setFinalExamResultDate(schedule.finalExamResultDate);
    setConfermentDate(schedule.confermentDate);
    setCompletionDate(schedule.completionDate);
  }, [intakeName, intakeRows]);
  // 5. Payment Information
  const [discount, setDiscount] = useState<string>("");
  const [totalCourseAmount, setTotalCourseAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"One Time Settlement" | "Installment">("One Time Settlement");

  // 6. Additional Information
  const [country, setCountry] = useState<string>("Singapore");
  const [address, setAddress] = useState<string>("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageError, setImageError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter courses by selected course type
  const availableCourses = useMemo(() => {
    return COURSE_CATALOG.filter((c) => c.level === courseType);
  }, [courseType]);

  // Country options dynamically mapped from country.json
  const countryOptions: FilterSelectOption[] = useMemo(() => {
    return (countryData as CountryItem[]).map((c) => ({
      label: c.name,
      value: c.name,
      subLabel: `${c.code} • ${c.nationality}`,
    }));
  }, []);

  // Update selected course title and default fee when Course Type changes
  const handleCourseTypeChange = (newType: (typeof COURSE_TYPES)[number]) => {
    setCourseType(newType);
    const firstMatching = COURSE_CATALOG.find((c) => c.level === newType);
    if (firstMatching) {
      setCourseTitle(firstMatching.title);
      setTotalCourseAmount(firstMatching.defaultFee);
    }
  };

  // Update fee when specific course is selected
  const handleCourseTitleChange = (newTitle: string) => {
    setCourseTitle(newTitle);
    const match = COURSE_CATALOG.find((c) => c.title === newTitle);
    if (match) {
      setTotalCourseAmount(match.defaultFee);
    }
  };

  useEffect(() => {
    if (!courseTitle && COURSE_CATALOG.length) setCourseTitle(COURSE_CATALOG.find(c => c.level === courseType)?.title || COURSE_CATALOG[0].title);
    if (!PAYMENT_SCHEMES.includes(coursePaymentScheme)) setCoursePaymentScheme(PAYMENT_SCHEMES[0] || "");
  }, [COURSE_CATALOG, PAYMENT_SCHEMES, courseTitle, coursePaymentScheme, courseType]);

  useEffect(() => {
    if (selectedCourseType && COURSE_TYPES.includes(selectedCourseType as typeof COURSE_TYPES[number])) setCourseType(selectedCourseType as typeof COURSE_TYPES[number]);
  }, [selectedCourseType]);
  const selectedSchemeAmount = schemes.find(s => s.id === coursePaymentScheme)?.totalFee;
  useEffect(() => { if (selectedSchemeAmount != null) setTotalCourseAmount(String(selectedSchemeAmount)); }, [selectedSchemeAmount, coursePaymentScheme]);

  // Image upload handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateFileUpload(file, { maxSizeBytes: 2 * 1024 * 1024 });
      if (!validation.isValid) {
        setImageError(validation.error || "Invalid file format or size too large (max 2MB).");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setImageError("");
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setStudentImage(reader.result);
        }
      };
      reader.onerror = () => {
        setImageError("Failed to process selected image file.");
      };
      reader.readAsDataURL(file);
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (optionsLoading || optionsError) { errs.courseTitle = optionsError || "Course options are still loading."; setErrors(errs); return false; }

    if (!fullName.trim()) {
      errs.fullName = "Full name is required";
    }

    if (!idNumber.trim()) {
      errs.idNumber = `${idType} number is required`;
    }

    if (!dateOfBirth) {
      errs.dateOfBirth = "Date of birth is required";
    }

    if (!courseTitle.trim()) {
      errs.courseTitle = "Please select an academic course";
    }

    if (!enrollmentDate) {
      errs.enrollmentDate = "Enrollment date is required";
    }

    if (!totalCourseAmount.trim()) {
      errs.totalCourseAmount = "Total course amount is required";
    }

    if (!country.trim()) {
      errs.country = "Country is required";
    }

    if (!address.trim()) {
      errs.address = "Address is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const matchingCourse = COURSE_CATALOG.find((c) => c.title === courseTitle);
      const generatedCode = matchingCourse?.code || "AWC-CR";
      const generatedCategory = matchingCourse?.category || "School of Higher Studies";
      const studentYear = enrollmentDate ? new Date(enrollmentDate).getFullYear() : 2026;
      const randomIdSuffix = Math.floor(1000 + Math.random() * 9000);
      const newStudentId = `AWC-${studentYear}-${randomIdSuffix}`;

      // Build email and phone if not manually filled
      const sanitizedName = sanitizeInput(fullName);
      const generatedEmail = email.trim();
      const generatedPhone = phone.trim();

      const formattedEnrollmentDate = formatDisplayDate(enrollmentDate);
      const formattedIntakeDate = formatDisplayDate(intakeDate);
      const formattedExamDate = formatDisplayDate(finalExamResultDate);
      const formattedConfermentDate = formatDisplayDate(confermentDate);
      const formattedCompletionDate = formatDisplayDate(completionDate);
      const formattedDOB = formatDisplayDate(dateOfBirth);

      const matchingCountry = (countryData as CountryItem[]).find((c) => c.name.toLowerCase() === country.toLowerCase());
      const studentNationality = matchingCountry?.nationality || country;

      const newStudent: CollegeStudent = {
        id: `std-${Date.now()}`,
        studentId: newStudentId,
        name: sanitizedName,
        avatar: studentImage || "",
        email: generatedEmail,
        phone: generatedPhone,
        course: courseTitle,
        courseCode: generatedCode,
        category: generatedCategory,
        intake: intakeName,
        status: "Enrolled",
        nationality: studentNationality,
        country: country,
        location: `${country}`,
        joinedDate: formattedEnrollmentDate || formattedIntakeDate,
        admissionDate: formattedIntakeDate,
        enrollmentDate: formattedEnrollmentDate,
        studentType: studentType,
        passportOrNric: `${idType} ${idNumber.trim()}`,
        passportNo: idType === "Passport" ? idNumber.trim() : undefined,
        nric: idType === "NRIC" ? idNumber.trim() : undefined,
        salutation: salutation,
        finNumber: finNumber.trim() || undefined,
        idType: idType,
        idNumber: idNumber.trim(),
        dateOfBirth: formattedDOB,
        courseType: courseType,
        coursePaymentScheme: coursePaymentScheme,
        agent: agent,
        representative: representative,
        intakeName: intakeName,
        intakeMonth: intakeMonth,
        intakeDate: formattedIntakeDate,
        finalExamResultDate: formattedExamDate,
        confermentDate: formattedConfermentDate,
        completionDate: formattedCompletionDate,
        discount: discount.trim() || undefined,
        totalCourseAmount: totalCourseAmount.trim(),
        paymentMethod: paymentMethod,
        address: sanitizeInput(address),
      };

      if (await onAddStudent(newStudent) === false) return;
      handleResetForm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setStudentImage("");
    setSalutation("Mr");
    setFullName("");
    setEmail("");
    setPhone("");
    setStudentType("International");
    setFinNumber("");
    setIdType("Passport");
    setIdNumber("");
    setDateOfBirth("");
    setCourseType("Post Graduation");
    setCourseTitle("");
    setCoursePaymentScheme(PAYMENT_SCHEMES[0] || "");
    setAgent(AGENTS_LIST[0] || "");
    setRepresentative(REPRESENTATIVES_LIST[0] || "");
    setIntakeName(INTAKE_NAMES[0] || "");
    setIntakeMonth("January");
    setIntakeDate("");
    setFinalExamResultDate("");
    setConfermentDate("");
    setCompletionDate("");
    setEnrollmentDate("");
    setDiscount("");
    setTotalCourseAmount("");
    setPaymentMethod("One Time Settlement");
    setCountry("Singapore");
    setAddress("");
    setErrors({});
    setImageError("");
  };

  const handleModalClose = () => {
    handleResetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Add New Student"
      subtitle="Complete student registration dossier, course affiliation, and enrollment milestones"
      headerIcon={<GraduationCap className="h-5 w-5 text-burgundy-primary" />}
      maxWidth="5xl"
      fullScreen={fullScreen}
      showFullScreenToggle={true}
      closeOnBackdropClick={false}
      topAccentBar={true}
      className="p-5 sm:p-6"
      bodyClassName="flex-1 min-h-0 flex flex-col"
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col"
      >
        {/* Scrollable Form Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-1 pb-4 pr-2.5">
          {/* SECTION 1: Personal Information */}
          <div className="rounded-2xl border border-brand-border bg-brand-bg/30 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-brand-border/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-burgundy-primary/10 text-burgundy-primary">
                  <User className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Personal Information</h4>
                  <p className="text-[11px] text-text-muted">
                    Biographical identity, photograph, student classification, and identification document
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-burgundy-primary/10 px-2 py-0.5 text-[10px] font-semibold text-burgundy-primary">Step 1 of 6</span>
            </div>

            {/* Student Image Upload & Preview */}
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-dashed border-brand-border bg-white p-3.5 sm:flex-row sm:items-center">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-burgundy-primary/30 bg-brand-bg shadow-sm">
                {studentImage ? (
                  <img
                    src={studentImage}
                    alt="Student Avatar"
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
                    id="student-image-file"
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
                  {studentImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStudentImage("");
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

            {/* Personal Details Grid */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Salutation */}
              <div>
                <FilterSelect
                  label="Salutation"
                  required
                  value={salutation}
                  options={[
                    { label: "Mr", value: "Mr" },
                    { label: "MS", value: "MS" },
                  ]}
                  onChange={(val) => setSalutation(val as "Mr" | "MS")}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                />
              </div>

              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Full Name <span className="text-brand-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Liam Joshua Vance"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: "" }));
                  }}
                  className={`w-full rounded-xl border ${
                    errors.fullName ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                  } bg-white px-3 py-2 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
                />
                {errors.fullName && <p className="mt-1 text-[11px] text-brand-red">{errors.fullName}</p>}
              </div>

              {/* Student Type */}
              <div>
                <FilterSelect
                  label="Student Type"
                  required
                  value={studentType}
                  options={[
                    { label: "International", value: "International", badgeDot: "bg-blue-500" },
                    { label: "Local", value: "Local", badgeDot: "bg-emerald-500" },
                    { label: "Overseas", value: "Overseas", badgeDot: "bg-purple-500" },
                  ]}
                  onChange={(val) => setStudentType(val as "International" | "Local" | "Overseas")}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                />
              </div>

              {/* FIN Number (optional) */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  FIN Number <span className="text-[11px] font-normal text-text-muted">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. F9812456A / G2349182K"
                  value={finNumber}
                  onChange={(e) => setFinNumber(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Date of Birth <span className="text-brand-red">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    if (errors.dateOfBirth) setErrors((prev) => ({ ...prev, dateOfBirth: "" }));
                  }}
                  className={`w-full rounded-xl border ${
                    errors.dateOfBirth ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                  } bg-white px-3 py-2 text-xs text-text-primary transition-all focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
                />
                {errors.dateOfBirth && <p className="mt-1 text-[11px] text-brand-red">{errors.dateOfBirth}</p>}
              </div>

              {/* Choose an ID & ID Number */}
              <div>
                <FilterSelect
                  label="Choose an ID"
                  required
                  value={idType}
                  options={[
                    { label: "NRIC", value: "NRIC" },
                    { label: "Passport", value: "Passport" },
                  ]}
                  onChange={(val) => setIdType(val as "NRIC" | "Passport")}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  {idType} Number <span className="text-brand-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={idType === "NRIC" ? "e.g. S9812345Z or M9401284K" : "e.g. A92837419 or P839210"}
                  value={idNumber}
                  onChange={(e) => {
                    setIdNumber(e.target.value);
                    if (errors.idNumber) setErrors((prev) => ({ ...prev, idNumber: "" }));
                  }}
                  className={`w-full rounded-xl border ${
                    errors.idNumber ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                  } bg-white px-3 py-2 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
                />
                {errors.idNumber && <p className="mt-1 text-[11px] text-brand-red">{errors.idNumber}</p>}
              </div>

              {/* Email (Optional Helper) */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Student Email <span className="text-[11px] font-normal text-text-muted">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
                  <input
                    type="email"
                    placeholder="student@avisworld.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-white py-2 pl-8 pr-3 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                  />
                </div>
              </div>

              {/* Phone (Optional Helper) */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Contact Phone <span className="text-[11px] font-normal text-text-muted">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
                  <input
                    type="tel"
                    placeholder="+230 5254 9910 or +65 9123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-white py-2 pl-8 pr-3 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Education Information */}
          <div className="rounded-2xl border border-brand-border bg-brand-bg/30 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-brand-border/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-burgundy-primary/10 text-burgundy-primary">
                  <GraduationCap className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Education Information</h4>
                  <p className="text-[11px] text-text-muted">Curriculum qualification tier, enrolled course program, and payment tariff scheme</p>
                </div>
              </div>
              <span className="rounded-full bg-burgundy-primary/10 px-2 py-0.5 text-[10px] font-semibold text-burgundy-primary">Step 2 of 6</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Course Type */}
              <div>
                <FilterSelect
                  label="Course Type"
                  required
                  value={courseType}
                  options={COURSE_TYPES.map((type) => ({ label: type, value: type }))}
                  onChange={(val) => handleCourseTypeChange(val as (typeof COURSE_TYPES)[number])}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                />
              </div>

              {/* Course */}
              <div className="sm:col-span-2">
                <FilterSelect
                  label="Course"
                  required
                  searchable
                  searchPlaceholder="Search academic program..."
                  hasError={Boolean(errors.courseTitle)}
                  value={courseTitle}
                  options={availableCourses.map((c) => ({
                    label: `${c.title} (${c.code})`,
                    value: c.title,
                    subLabel: `${c.category} • ${c.defaultFee}`,
                  }))}
                  onChange={handleCourseTitleChange}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                  menuClassName="w-full min-w-full max-w-none"
                />
                {errors.courseTitle && <p className="mt-1 text-[11px] text-brand-red">{errors.courseTitle}</p>}
              </div>

              {/* Course Payment Scheme */}
              <div className="sm:col-span-3">
                <FilterSelect
                  label="Course Payment Scheme"
                  required
                  value={coursePaymentScheme}
                  options={paymentSchemeOptions}
                  onChange={setCoursePaymentScheme}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                  menuClassName="w-full min-w-full max-w-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Agents and Representatives */}
          <div className="rounded-2xl border border-brand-border bg-brand-bg/30 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-brand-border/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-burgundy-primary/10 text-burgundy-primary">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Agents and Representatives</h4>
                  <p className="text-[11px] text-text-muted">Channel recruitment agency partnership and internal admissions officer assignment</p>
                </div>
              </div>
              <span className="rounded-full bg-burgundy-primary/10 px-2 py-0.5 text-[10px] font-semibold text-burgundy-primary">Step 3 of 6</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {/* Agents */}
              <div>
                <FilterSelect
                  label="Agents"
                  required
                  searchable
                  searchPlaceholder="Search partner agent..."
                  value={agent}
                  options={AGENTS_LIST.map((ag) => ({ label: ag, value: ag }))}
                  onChange={setAgent}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                  menuClassName="w-full min-w-full max-w-none"
                />
              </div>

              {/* Representative */}
              <div>
                <FilterSelect
                  label="Representative"
                  required
                  searchable
                  searchPlaceholder="Search admissions counselor..."
                  value={representative}
                  options={REPRESENTATIVES_LIST.map((rep) => ({ label: rep, value: rep }))}
                  onChange={setRepresentative}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                  menuClassName="w-full min-w-full max-w-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Intake Information */}
          <div className="rounded-2xl border border-brand-border bg-brand-bg/30 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-brand-border/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-burgundy-primary/10 text-burgundy-primary">
                  <CalendarRange className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Intake Information</h4>
                  <p className="text-[11px] text-text-muted">
                    Cohort milestone scheduling, academic commencement, exam results, and degree conferment
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-burgundy-primary/10 px-2 py-0.5 text-[10px] font-semibold text-burgundy-primary">Step 4 of 6</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Intake Name */}
              <div>
                <FilterSelect
                  label="Intake Name"
                  required
                  value={intakeName}
                  options={INTAKE_NAMES.map((name) => ({ label: name, value: name }))}
                  onChange={setIntakeName}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                  menuClassName="w-full min-w-full max-w-none"
                />
              </div>

              {/* Intake (month) */}
              <div>
                <FilterSelect
                  label="Intake Month"
                  required
                  searchable
                  searchPlaceholder="Search month..."
                  value={intakeMonth}
                  options={INTAKE_MONTHS.map((month) => ({ label: month, value: month }))}
                  onChange={setIntakeMonth}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                />
              </div>

              {/* Intake Date */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Intake Date <span className="text-brand-red">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={intakeDate}
                  onChange={(e) => setIntakeDate(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs text-text-primary transition-all focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                />
              </div>

              {/* Enrollment Date */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Enrollment Date <span className="text-brand-red">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={enrollmentDate}
                  onChange={(e) => {
                    setEnrollmentDate(e.target.value);
                    if (errors.enrollmentDate) setErrors((prev) => ({ ...prev, enrollmentDate: "" }));
                  }}
                  className={`w-full rounded-xl border ${
                    errors.enrollmentDate ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                  } bg-white px-3 py-2 text-xs text-text-primary transition-all focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
                />
                {errors.enrollmentDate && <p className="mt-1 text-[11px] text-brand-red">{errors.enrollmentDate}</p>}
              </div>

              {/* Final Exam Result Date */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Final Exam Result Date <span className="text-brand-red">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={finalExamResultDate}
                  onChange={(e) => setFinalExamResultDate(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs text-text-primary transition-all focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                />
              </div>

              {/* Conferment Date */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Conferment Date <span className="text-brand-red">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={confermentDate}
                  onChange={(e) => setConfermentDate(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs text-text-primary transition-all focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                />
              </div>

              {/* Completion Date */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Completion Date <span className="text-brand-red">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs text-text-primary transition-all focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: Payment Information */}
          <div className="rounded-2xl border border-brand-border bg-brand-bg/30 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-brand-border/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-burgundy-primary/10 text-burgundy-primary">
                  <CreditCard className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Payment Information</h4>
                  <p className="text-[11px] text-text-muted">Course fee schedule, applied bursary discounts, and settlement arrangement</p>
                </div>
              </div>
              <span className="rounded-full bg-burgundy-primary/10 px-2 py-0.5 text-[10px] font-semibold text-burgundy-primary">Step 5 of 6</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              {/* Total Course Amount */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Total Course Amount <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. $14,800"
                    value={totalCourseAmount}
                    onChange={(e) => {
                      setTotalCourseAmount(e.target.value);
                      if (errors.totalCourseAmount) setErrors((prev) => ({ ...prev, totalCourseAmount: "" }));
                    }}
                    className={`w-full rounded-xl border ${
                      errors.totalCourseAmount ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                    } bg-white py-2 pl-8 pr-3 text-xs text-text-primary transition-all focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
                  />
                </div>
                {errors.totalCourseAmount && <p className="mt-1 text-[11px] text-brand-red">{errors.totalCourseAmount}</p>}
              </div>

              {/* Discount (optional) */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Discount <span className="text-[11px] font-normal text-text-muted">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10% or $500"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                />
              </div>

              {/* Payment Mode */}
              <div>
                <FilterSelect
                  label="Payment"
                  required
                  value={paymentMethod}
                  options={[
                    { label: "One Time Settlement", value: "One Time Settlement" },
                    { label: "Installment", value: "Installment" },
                  ]}
                  onChange={(val) => setPaymentMethod(val as "One Time Settlement" | "Installment")}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* SECTION 6: Additional Information */}
          <div className="rounded-2xl border border-brand-border bg-brand-bg/30 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-brand-border/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-burgundy-primary/10 text-burgundy-primary">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Additional Information</h4>
                  <p className="text-[11px] text-text-muted">Country of citizenship/origin and formal correspondence address</p>
                </div>
              </div>
              <span className="rounded-full bg-burgundy-primary/10 px-2 py-0.5 text-[10px] font-semibold text-burgundy-primary">Step 6 of 6</span>
            </div>

            <div className="space-y-3.5">
              {/* Country */}
              <div>
                <FilterSelect
                  label="Country"
                  required
                  searchable
                  searchPlaceholder="Search 240+ countries or code..."
                  hasError={Boolean(errors.country)}
                  value={country}
                  options={countryOptions}
                  onChange={(val) => {
                    setCountry(val);
                    if (errors.country) setErrors((prev) => ({ ...prev, country: "" }));
                  }}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
                  menuClassName="w-full min-w-full max-w-none"
                />
                {errors.country && <p className="mt-1 text-[11px] text-brand-red">{errors.country}</p>}
              </div>

              {/* Address */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">
                  Address <span className="text-brand-red">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. 14 Robinson Road, Far East Finance Building, #08-01, Singapore 048545"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (errors.address) setErrors((prev) => ({ ...prev, address: "" }));
                  }}
                  className={`w-full rounded-xl border ${
                    errors.address ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                  } bg-white p-3 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
                />
                {errors.address && <p className="mt-1 text-[11px] text-brand-red">{errors.address}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex w-full shrink-0 flex-col gap-3 border-t border-brand-border bg-white pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-text-muted">
            Fields marked with <span className="font-semibold text-brand-red">*</span> are mandatory for institutional compliance.
          </p>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleModalClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || optionsLoading}
              className="gap-1.5 bg-burgundy-hover text-xs font-semibold text-white shadow-md shadow-burgundy-hover/20 hover:bg-burgundy-light"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Enrolling..." : "Enroll Student"}</span>
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default AddStudentModal;
