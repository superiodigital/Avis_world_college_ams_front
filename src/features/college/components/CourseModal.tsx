import React, { useState, useEffect } from "react";
import { BookOpen, Clock, DollarSign, Tag, GraduationCap, FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { CollegeCourse } from "../types";
import { sanitizeInput } from "@/lib/security";

export interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (course: CollegeCourse) => void | boolean | Promise<void | boolean>;
  course?: CollegeCourse | null;
  availableCategories?: string[];
}

export const COURSE_TYPES = ["Post Graduation", "Higher Diploma", "Diploma", "Certificate", "Postgraduate"] as const;

export const DEFAULT_CATEGORIES = [
  "School of Computing & AI",
  "School of Business",
  "School of Hospitality",
  "School of Design",
  "Health Sciences & Wellness",
  "Languages & Foundation Studies",
];

export const DURATION_SUGGESTIONS = [
  "4 Years (Full-time)",
  "3 Years (Full-time)",
  "2 Years (Full-time)",
  "2 Years (Hybrid)",
  "1 Year (Full-time)",
  "6 Months (Intensive)",
];

export const CourseModal: React.FC<CourseModalProps> = ({ isOpen, onClose, onSave, course }) => {
  const isEditing = Boolean(course);

  // The 6 Specified Form States:
  // 1. Course Type
  const [courseType, setCourseType] = useState<string>("Post Graduation");
  // 2. Course (Title/Name)
  const [courseTitle, setCourseTitle] = useState("");
  // 3. Course Code
  const [courseCode, setCourseCode] = useState("");
  // 4. Duration
  const [duration, setDuration] = useState("");
  // 5. Application Fees
  const [applicationFee, setApplicationFee] = useState("");
  // 6. Requirement Description
  const [requirementDescription, setRequirementDescription] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form if editing
  useEffect(() => {
    if (isOpen) {
      if (course) {
        setCourseType(course.courseType || course.level || "Post Graduation");
        setCourseTitle(course.title || "");
        setCourseCode(course.code || "");
        setDuration(course.duration || "");
        setApplicationFee(course.applicationFee ?? "");
        setRequirementDescription(course.requirementDescription || "");
      } else {
        setCourseType("Post Graduation");
        setCourseTitle("");
        setCourseCode("");
        setDuration("");
        setApplicationFee("");
        setRequirementDescription("");
      }
      setErrors({});
    }
  }, [isOpen, course]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!courseType.trim()) {
      errs.courseType = "Course Type is required";
    }
    if (!courseTitle.trim()) {
      errs.courseTitle = "Course is required";
    }
    if (!courseCode.trim()) {
      errs.courseCode = "Course Code is required";
    }
    if (!duration.trim()) {
      errs.duration = "Duration is required";
    }
    if (!applicationFee.trim()) {
      errs.applicationFee = "Application Fees are required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const sanitizedCode = sanitizeInput(courseCode.trim().toUpperCase());
      const sanitizedTitle = sanitizeInput(courseTitle.trim());
      const sanitizedDuration = sanitizeInput(duration.trim());
      const sanitizedAppFee = sanitizeInput(applicationFee.trim());
      const sanitizedReqs = sanitizeInput(requirementDescription.trim());

      // Derive clean level matching CollegeCourse union
      let derivedLevel: CollegeCourse["level"] = "Undergraduate";
      if (courseType === "Post Graduation" || courseType === "Postgraduate") {
        derivedLevel = "Postgraduate";
      } else if (courseType === "Diploma" || courseType === "Higher Diploma") {
        derivedLevel = "Diploma";
      } else if (courseType === "Certificate") {
        derivedLevel = "Certificate";
      }

      const updatedCourse: CollegeCourse = {
        id: course?.id || `crs-${Date.now()}`,
        code: sanitizedCode,
        title: sanitizedTitle,
        level: derivedLevel,
        courseType: courseType,
        category: course?.category || "",
        department: course?.department || "",
        duration: sanitizedDuration,
        applicationFee: sanitizedAppFee,
        fee: course?.fee || sanitizedAppFee,
        requirementDescription: sanitizedReqs,
        seats: course?.seats ?? 0,
        enrolled: course?.enrolled ?? 0,
        status: course?.status || "Active",
        intakes: course?.intakes || [],
      };

      if (await onSave(updatedCourse) === false) return;
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Course" : "Add Course"}
      subtitle={
        isEditing
          ? "Update course curriculum specifications, duration, application fees, and requirement description"
          : "Fill in the course type, title, code, duration, application fees, and requirements to register a new course"
      }
      headerIcon={<BookOpen className="h-5 w-5 text-burgundy-primary" />}
      maxWidth="2xl"
      topAccentBar={true}
      className="p-5 sm:p-6"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 1. Course Type */}
          <div>
            <FilterSelect
              label="Course Type"
              icon={GraduationCap}
              required
              value={courseType}
              options={COURSE_TYPES.map((type) => ({
                label: type,
                value: type,
              }))}
              onChange={(val) => {
                setCourseType(val);
                if (errors.courseType) setErrors((prev) => ({ ...prev, courseType: "" }));
              }}
              buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl"
            />
            {errors.courseType && <p className="mt-1 text-[11px] text-brand-red">{errors.courseType}</p>}
          </div>

          {/* 3. Course Code */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary">
              Course Code <span className="text-brand-red">*</span>
            </label>
            <div className="relative">
              <Tag className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                required
                placeholder="e.g. BSc-DS, MSc-AAI"
                value={courseCode}
                onChange={(e) => {
                  setCourseCode(e.target.value.toUpperCase());
                  if (errors.courseCode) setErrors((prev) => ({ ...prev, courseCode: "" }));
                }}
                className={`w-full rounded-xl border ${
                  errors.courseCode ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                } bg-white py-2 pl-9 pr-3 font-mono text-xs text-text-primary transition-all placeholder:font-sans placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
              />
            </div>
            {errors.courseCode && <p className="mt-1 text-[11px] text-brand-red">{errors.courseCode}</p>}
          </div>

          {/* 2. Course (Title) */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-text-primary">
              Course <span className="text-brand-red">*</span>
            </label>
            <div className="relative">
              <BookOpen className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                required
                placeholder="e.g. Bachelor of Science in Data Science & Artificial Intelligence"
                value={courseTitle}
                onChange={(e) => {
                  setCourseTitle(e.target.value);
                  if (errors.courseTitle) setErrors((prev) => ({ ...prev, courseTitle: "" }));
                }}
                className={`w-full rounded-xl border ${
                  errors.courseTitle ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                } bg-white py-2 pl-9 pr-3 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
              />
            </div>
            {errors.courseTitle && <p className="mt-1 text-[11px] text-brand-red">{errors.courseTitle}</p>}
          </div>

          {/* 4. Duration */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary">
              Duration <span className="text-brand-red">*</span>
            </label>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                required
                placeholder="e.g. 4 Years (Full-time)"
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  if (errors.duration) setErrors((prev) => ({ ...prev, duration: "" }));
                }}
                className={`w-full rounded-xl border ${
                  errors.duration ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                } bg-white py-2 pl-9 pr-3 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
              />
            </div>
            {errors.duration && <p className="mt-1 text-[11px] text-brand-red">{errors.duration}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {DURATION_SUGGESTIONS.slice(0, 3).map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setDuration(dur)}
                  className="rounded-md border border-brand-border bg-brand-bg/60 px-1.5 py-0.5 text-[10px] text-text-secondary transition-colors hover:bg-brand-border/60 hover:text-text-primary"
                >
                  {dur}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Application Fees */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary">
              Application Fees <span className="text-brand-red">*</span>
            </label>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                required
                placeholder="e.g. $150 or $200"
                value={applicationFee}
                onChange={(e) => {
                  setApplicationFee(e.target.value);
                  if (errors.applicationFee) setErrors((prev) => ({ ...prev, applicationFee: "" }));
                }}
                className={`w-full rounded-xl border ${
                  errors.applicationFee ? "border-brand-red ring-1 ring-brand-red" : "border-brand-border"
                } bg-white py-2 pl-9 pr-3 text-xs font-semibold text-text-primary transition-all placeholder:font-normal placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary`}
              />
            </div>
            {errors.applicationFee && <p className="mt-1 text-[11px] text-brand-red">{errors.applicationFee}</p>}
          </div>

          {/* 6. Requirement Description */}
          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center justify-between text-xs font-semibold text-text-primary">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-burgundy-primary" />
                Requirement Description
              </span>
              <span className="text-[10px] font-normal text-text-muted">{requirementDescription.length} characters</span>
            </label>
            <textarea
              rows={4}
              placeholder="Specify admission entry requirements, prerequisite academic qualifications (e.g. GCE A-Levels, High School Diploma), English proficiency (e.g. IELTS 6.5), or relevant work experience..."
              value={requirementDescription}
              onChange={(e) => setRequirementDescription(e.target.value)}
              className="w-full rounded-xl border border-brand-border bg-white px-3.5 py-2.5 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
            />
            <p className="mt-1 text-[11px] text-text-muted">
              Add key eligibility guidelines, minimum GPA/grades, and prerequisite documents needed for applicant assessment.
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-brand-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl border-brand-border text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="burgundy"
            size="sm"
            disabled={isSubmitting}
            className="rounded-xl text-xs font-semibold"
          >
            {isEditing ? "Save Changes" : "Create Course"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CourseModal;
