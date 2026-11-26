import {courseRequirements} from "@/services/courseFields";
import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Landmark,
  DollarSign,
  Receipt,
  Plus,
  Trash2,
  ArrowLeft,
  FileText,
  GraduationCap,
  Calculator,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Edit3,
} from "lucide-react";
import BreadcrumbBanner from "@/components/common/BreadcrumbBanner";
import { Button } from "@/components/ui/Button";
import { DeleteModal } from "@/components/ui/DeleteModal";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { AddFeeTypeModal, AddRequirementModal } from "./components";
import { courses, apiMessage } from "@/services/ams";
import { apiClient } from "@/services/api/apiClient";
import { useApiCollection } from "@/hooks/useApiCollection";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { CourseRequirement, CourseFeeBreakdown } from "./types";

import { toast } from "@/components/common/ToastMessage";
import { dashboardContainerVariants, dashboardSectionVariants } from "@/components/animations/transitions";



export const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  // Load all courses from storage
  const { data: coursesList, loading, error, reload } = useApiCollection(courses);

  // Find targeted course
  const currentCourse = useMemo(() => {
    if (!courseId) return null;
    const lowerId = courseId.toLowerCase();
    return coursesList.find((c) => c.id.toLowerCase() === lowerId || c.code.toLowerCase() === lowerId) || null;
  }, [coursesList, courseId]);

  // Requirements state
  const [requirements, setRequirements] = useState<CourseRequirement[]>(() => {
    if (currentCourse?.requirements && currentCourse.requirements.length > 0) {
      return currentCourse.requirements;
    }
    return [];
  });

  // Fee schemes state
  const [feeSchemes, setFeeSchemes] = useState<CourseFeeBreakdown[]>(() => {
    if (currentCourse?.feeBreakdownSchemes && currentCourse.feeBreakdownSchemes.length > 0) {
      return currentCourse.feeBreakdownSchemes;
    }
    return [];
  });

  // Selected Fee Scheme ID
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>(() => {
    if (currentCourse?.feeBreakdownSchemes && currentCourse.feeBreakdownSchemes.length > 0) {
      return currentCourse.feeBreakdownSchemes[0].id;
    }
    return "";
  });

  // Active Fee Scheme
  const activeScheme = useMemo(() => {
    return feeSchemes.find((s) => s.id === selectedSchemeId) || feeSchemes[0] || { id: "", name: "", schemeCode: "", tuitionFee: 0, medicalInsurance: 0, resourceFee: 0, assessmentFee: 0, feeProtection: 0, uniformFee: 0, adminFee: 0, gstRate: 0 };
  }, [feeSchemes, selectedSchemeId]);

  // Modal states
  const [isAddFeeTypeModalOpen, setIsAddFeeTypeModalOpen] = useState(false);
  const [isDeleteFeeTypeModalOpen, setIsDeleteFeeTypeModalOpen] = useState(false);
  const [isAddRequirementModalOpen, setIsAddRequirementModalOpen] = useState(false);

  useEffect(() => {
    setRequirements(currentCourse?.requirements || []);
    setFeeSchemes(currentCourse?.feeBreakdownSchemes || []);
    setSelectedSchemeId(previous => currentCourse?.feeBreakdownSchemes?.some(s => s.id === previous) ? previous : currentCourse?.feeBreakdownSchemes?.[0]?.id || "");
  }, [currentCourse]);
  const persistCourseData = async (updatedRequirements: CourseRequirement[], updatedSchemes: CourseFeeBreakdown[]) => {
    if (!currentCourse) return false;
    try {
      if (JSON.stringify(updatedRequirements) !== JSON.stringify(currentCourse.requirements || [])) await apiClient.put(`/api/admin/edit-courses/${currentCourse.id}`, { requirements: updatedRequirements, requirementDescription: updatedRequirements.map(row => row.description).join("\n") });
      const previous = currentCourse.feeBreakdownSchemes || [];
      for (const scheme of updatedSchemes) {
        const old = previous.find(s => s.id === scheme.id);
        if (JSON.stringify(old) === JSON.stringify(scheme)) continue;
        const subtotal = scheme.tuitionFee + scheme.medicalInsurance + scheme.resourceFee + scheme.assessmentFee + scheme.feeProtection + scheme.uniformFee + scheme.adminFee - (scheme.discount || 0);
        const body = { ...scheme, gst: Number((subtotal * (scheme.gstRate || 0)).toFixed(2)), totalFee: Number((subtotal * (1 + (scheme.gstRate || 0))).toFixed(2)) };
        if (old) await apiClient.put(`/api/admin/edit-courses-feeType/${currentCourse.id}/fees/${scheme.id}`, body);
        else await apiClient.post(`/api/admin/courses/${currentCourse.id}/fees`, body);
      }
      for (const scheme of previous) if (!updatedSchemes.some(s => s.id === scheme.id)) await apiClient.delete(`/api/admin/delete-courses-feeType/${currentCourse.id}/fees/${scheme.id}`);
      await reload(); return true;
    } catch (error) { toast.error("Unable to save course", { description: apiMessage(error) }); await reload(); return false; }
  };

  // Live recalculate subtotal, GST (9%), and total payable for active scheme
  const subtotal = useMemo(() => {
    if (!activeScheme) return 0;
    return (
      Number(activeScheme.tuitionFee || 0) +
      Number(activeScheme.medicalInsurance || 0) +
      Number(activeScheme.resourceFee || 0) +
      Number(activeScheme.assessmentFee || 0) +
      Number(activeScheme.feeProtection || 0) +
      Number(activeScheme.uniformFee || 0) +
      Number(activeScheme.adminFee || 0) - Number(activeScheme.discount || 0)
    );
  }, [activeScheme]);

  const gstRate = activeScheme?.gstRate ?? 0.09;
  const gstAmount = useMemo(() => {
    return subtotal * gstRate;
  }, [subtotal, gstRate]);

  const totalFeePayable = useMemo(() => {
    return subtotal + gstAmount;
  }, [subtotal, gstAmount]);

  // Update specific fee amount in active scheme
  const handleFeeAmountChange = (field: keyof Omit<CourseFeeBreakdown, "id" | "name" | "schemeCode" | "currency" | "gstRate">, valueStr: string) => {
    const numericVal = valueStr === "" ? 0 : Number(valueStr);
    if (isNaN(numericVal)) return;

    const updatedSchemes = feeSchemes.map((s) => {
      if (s.id === activeScheme.id) {
        return {
          ...s,
          [field]: numericVal,
        };
      }
      return s;
    });

    setFeeSchemes(updatedSchemes);

  };

  // Add new fee scheme
  const handleAddFeeScheme = async (newScheme: CourseFeeBreakdown) => {
    const updatedSchemes = [...feeSchemes, newScheme];
    if (!await persistCourseData(requirements, updatedSchemes)) return false;
    setFeeSchemes(updatedSchemes);
    setSelectedSchemeId(newScheme.id);
    persistCourseData(requirements, updatedSchemes);
    toast.success(`Fee scheme "${newScheme.name}" added successfully.`);
  };

  // Delete active fee type
  const handleDeleteActiveFeeType = async () => {
    if (feeSchemes.length <= 1) {
      toast.error("At least one fee type scheme is required.");
      setIsDeleteFeeTypeModalOpen(false);
      return;
    }

    const targetId = activeScheme.id;
    const targetName = activeScheme.name;
    const remainingSchemes = feeSchemes.filter((s) => s.id !== targetId);

    if (!await persistCourseData(requirements, remainingSchemes)) return false;
    setFeeSchemes(remainingSchemes);
    setSelectedSchemeId(remainingSchemes[0].id);

    setIsDeleteFeeTypeModalOpen(false);

    toast.success(`Fee type "${targetName}" removed.`);
  };

  const handleEditRequirements = async (description: string) => {
    const updated = courseRequirements(description);
    if (!await persistCourseData(updated, feeSchemes)) return false;
    setRequirements(updated);
    toast.success("Course requirements updated.");
  };

  const containerVariants = shouldReduceMotion ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : dashboardContainerVariants;

  const sectionVariants = shouldReduceMotion ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : dashboardSectionVariants;

  if (loading || error) return <AsyncStateView isLoading={loading} error={error} onRetry={() => void reload()}>{null}</AsyncStateView>;
  if (!currentCourse) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 pt-4">
        <div className="rounded-2xl border border-brand-border bg-white p-12 text-center shadow-card">
          <Landmark className="mx-auto mb-3 h-10 w-10 text-text-muted/60" />
          <h2 className="text-lg font-bold text-text-primary">Course Not Found</h2>
          <p className="mt-1 text-xs text-text-muted">
            The course with identifier &ldquo;{courseId}&rdquo; could not be located in the system registry.
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              variant="burgundy"
              size="sm"
              onClick={() => navigate("/college")}
              className="gap-2 rounded-xl text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to College</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const breadcrumbParts = [{ name: "College", path: "/college" }, { name: "Courses", path: "/college" }, { name: currentCourse.code }];

  const durationDisplay =
    currentCourse.durationDetail || currentCourse.duration || "—";

  const applicationFeesDisplay = currentCourse.applicationFee || "—";

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative mx-auto w-full space-y-4 pt-1"
    >
      {/* Breadcrumb Banner with Course Meta Badges */}
      <motion.div variants={sectionVariants}>
        <BreadcrumbBanner
          title={currentCourse.title}
          items={breadcrumbParts}
          containerClassName="mb-0"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <span className="shadow-2xs inline-flex items-center gap-1.5 rounded-xl border border-burgundy-primary/20 bg-burgundy-primary/10 px-3 py-1 font-mono text-xs font-bold text-burgundy-primary">
                <GraduationCap className="h-3.5 w-3.5" />
                <span>{currentCourse.code}</span>
              </span>
              <span className="shadow-2xs inline-flex items-center rounded-xl border border-brand-border bg-white px-3 py-1 text-xs font-semibold text-text-secondary">
                {currentCourse.courseType || currentCourse.level}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/college")}
                className="gap-1.5 rounded-xl border-brand-border text-xs text-text-secondary hover:bg-brand-bg hover:text-text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Courses</span>
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Top 3 Customized Metric Cards */}
      <motion.div variants={sectionVariants}>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {/* Card 1: Duration */}
          <div className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-burgundy-primary/5 blur-xl transition-colors group-hover:bg-burgundy-primary/10" />
            <div className="flex items-start gap-3.5">
              <div className="shadow-2xs flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-burgundy-primary/20 bg-burgundy-primary/10 text-burgundy-primary transition-transform duration-200 group-hover:scale-105">
                <Landmark className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Duration</h4>
                  <span className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-brand-bg px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                    <Clock className="h-2.5 w-2.5 text-burgundy-primary" />
                    <span>Curriculum</span>
                  </span>
                </div>
                <p
                  className="mt-1 text-xs font-semibold leading-relaxed text-text-primary"
                  title={durationDisplay}
                >
                  {durationDisplay}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Course Fees */}
          <div className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-light-red blur-xl transition-colors group-hover:bg-brand-red/10" />
            <div className="flex items-start gap-3.5">
              <div className="shadow-2xs flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-red/20 bg-brand-light-red text-brand-red transition-transform duration-200 group-hover:scale-105">
                <DollarSign className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Course Fees</h4>
                  <span className="inline-flex items-center gap-1 rounded-md border border-brand-red/20 bg-brand-light-red px-2 py-0.5 text-[10px] font-bold text-brand-red">
                    <Sparkles className="h-2.5 w-2.5" />
                    <span>{activeScheme.schemeCode}</span>
                  </span>
                </div>
                <p className="mt-1 font-mono text-lg font-black tracking-tight text-burgundy-primary">
                  SGD {totalFeePayable.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="mt-0.5 text-[11px] text-text-muted">Inclusive of 9% GST ({activeScheme.name})</p>
              </div>
            </div>
          </div>

          {/* Card 3: Application Fees */}
          <div className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-burgundy-primary/5 blur-xl transition-colors group-hover:bg-burgundy-primary/10" />
            <div className="flex items-start gap-3.5">
              <div className="shadow-2xs flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-burgundy-primary/20 bg-brand-light-red/60 text-burgundy-primary transition-transform duration-200 group-hover:scale-105">
                <Receipt className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Application Fees</h4>
                  <span className="inline-flex items-center rounded-md border border-brand-border bg-brand-bg px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                    One-time
                  </span>
                </div>
                <p className="mt-1 font-mono text-lg font-black tracking-tight text-text-primary">
                  {applicationFeesDisplay.startsWith("$") ? applicationFeesDisplay : `$${applicationFeesDisplay}`}
                </p>
                <p className="mt-0.5 text-[11px] text-text-muted">Non-refundable administrative fee</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main 2-Column Panels matching the user image:
          Left: Requirements Table (#, REQUIREMENT)
          Right: Select Fee Type, + Add Fee Type, Fees Breakdown Table & Delete Fee Type
      */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Column: Requirements Panel */}
        <motion.div variants={sectionVariants}>
          <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-brand-border/70 bg-gradient-to-r from-white via-brand-bg/40 to-white p-4">
                <div className="flex items-center gap-2.5">
                  <span className="shadow-2xs flex h-8 w-8 items-center justify-center rounded-xl border border-burgundy-primary/20 bg-burgundy-primary/10 text-burgundy-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">Course Requirements</h3>
                    <p className="text-[11px] text-text-muted">Academic, age & language prerequisites</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="shadow-2xs rounded-full border border-burgundy-primary/20 bg-burgundy-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-burgundy-primary">
                    {requirements.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddRequirementModalOpen(true)}
                    className="gap-1.5 rounded-xl border-burgundy-primary/30 text-xs font-semibold text-burgundy-primary hover:border-burgundy-primary hover:bg-brand-light-red/40"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </Button>
                </div>
              </div>

              {/* Requirements Table matching the image format */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-brand-border bg-brand-bg/85 font-bold uppercase tracking-wider text-text-secondary">
                    <tr>
                      <th className="w-14 px-4 py-3 text-center">#</th>
                      <th className="px-4 py-3">REQUIREMENT CRITERIA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/60">
                    {requirements.map((req, idx) => (
                      <tr
                        key={req.id || idx}
                        className="group transition-colors hover:bg-brand-light-red/20"
                      >
                        <td className="px-4 py-3.5 text-center">
                          <span className="shadow-2xs inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-border bg-brand-bg font-mono text-xs font-bold text-burgundy-primary transition-colors group-hover:border-burgundy-primary/30 group-hover:bg-burgundy-primary/10">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-burgundy-primary/40 transition-colors group-hover:text-burgundy-primary" />
                            <span className="text-xs font-medium leading-relaxed text-text-primary">{req.description}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom info banner */}
            <div className="flex items-center justify-between border-t border-brand-border/60 bg-brand-bg/40 px-4 py-3 text-[11px] text-text-muted">
              <div className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-burgundy-primary" />
                <span>All requirements must be fulfilled prior to enrollment</span>
              </div>
              <div>
                Total: <strong className="text-text-primary">{requirements.length} Criteria</strong>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Fees Breakdown & Scheme Selector */}
        <motion.div variants={sectionVariants}>
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card sm:p-5">
            {/* Top Selector & Add Fee Type Button */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1 sm:max-w-xs">
                <FilterSelect
                  label="Select Fee Type"
                  value={selectedSchemeId}
                  options={feeSchemes.map((scheme) => ({
                    label: scheme.name,
                    value: scheme.id,
                    subLabel: scheme.schemeCode,
                  }))}
                  onChange={(val) => setSelectedSchemeId(val)}
                  buttonClassName="bg-white border-brand-border py-2 px-3 text-xs rounded-xl shadow-2xs"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddFeeTypeModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-burgundy-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-burgundy-sidebar active:scale-95 sm:mb-0.5"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Add Fee Type</span>
              </button>
            </div>

            {/* Scheme Metadata Strip */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-border/80 bg-brand-bg/60 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-primary">Fees Breakdown</span>
                <span className="text-text-muted">•</span>
                <span className="text-xs font-medium text-text-secondary">{activeScheme.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="shadow-2xs inline-flex rounded-lg border border-burgundy-primary/20 bg-burgundy-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-burgundy-primary">
                  {activeScheme.schemeCode}
                </span>
                <span className="rounded border border-brand-border bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-text-secondary">
                  GST: 9%
                </span>
              </div>
            </div>

            {/* Fees Breakdown Table */}
            <div className="mt-3 overflow-hidden rounded-xl border border-brand-border/80">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-brand-border bg-brand-bg/85 font-bold uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th className="px-4 py-2.5">DESCRIPTION</th>
                    <th className="px-4 py-2.5 text-right">AMOUNT (SGD) / VALUE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/60 bg-white">
                  {/* Name */}
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">Name</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-mono text-xs font-bold text-text-primary">{activeScheme.name}</span>
                    </td>
                  </tr>

                  {/* Scheme Code */}
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">Scheme Code</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="shadow-2xs inline-flex rounded-lg border border-burgundy-primary/20 bg-burgundy-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-burgundy-primary">
                        {activeScheme.schemeCode}
                      </span>
                    </td>
                  </tr>

                  {/* Tuition Fee */}
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">Tuition Fee</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center justify-end">
                        <span className="mr-1.5 font-mono text-[11px] font-bold text-text-muted">SGD</span>
                        <input
                          type="number"
                          min={0}
                          value={activeScheme.tuitionFee}
                          onChange={(e) => handleFeeAmountChange("tuitionFee", e.target.value)}
                          onBlur={() => { void persistCourseData(requirements, feeSchemes); }}
                          className="w-28 rounded-lg border border-brand-border bg-brand-bg/40 px-2.5 py-1 text-right font-mono text-xs font-semibold text-text-primary transition-all focus:border-burgundy-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Medical Insurance */}
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">Medical Insurance</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center justify-end">
                        <span className="mr-1.5 font-mono text-[11px] font-bold text-text-muted">SGD</span>
                        <input
                          type="number"
                          min={0}
                          value={activeScheme.medicalInsurance}
                          onChange={(e) => handleFeeAmountChange("medicalInsurance", e.target.value)}
                          onBlur={() => { void persistCourseData(requirements, feeSchemes); }}
                          className="w-28 rounded-lg border border-brand-border bg-brand-bg/40 px-2.5 py-1 text-right font-mono text-xs font-semibold text-text-primary transition-all focus:border-burgundy-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Resource Fee */}
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">Resource Fee</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center justify-end">
                        <span className="mr-1.5 font-mono text-[11px] font-bold text-text-muted">SGD</span>
                        <input
                          type="number"
                          min={0}
                          value={activeScheme.resourceFee}
                          onChange={(e) => handleFeeAmountChange("resourceFee", e.target.value)}
                          onBlur={() => { void persistCourseData(requirements, feeSchemes); }}
                          className="w-28 rounded-lg border border-brand-border bg-brand-bg/40 px-2.5 py-1 text-right font-mono text-xs font-semibold text-text-primary transition-all focus:border-burgundy-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Assessment Fee */}
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">Assessment Fee</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center justify-end">
                        <span className="mr-1.5 font-mono text-[11px] font-bold text-text-muted">SGD</span>
                        <input
                          type="number"
                          min={0}
                          value={activeScheme.assessmentFee}
                          onChange={(e) => handleFeeAmountChange("assessmentFee", e.target.value)}
                          onBlur={() => { void persistCourseData(requirements, feeSchemes); }}
                          className="w-28 rounded-lg border border-brand-border bg-brand-bg/40 px-2.5 py-1 text-right font-mono text-xs font-semibold text-text-primary transition-all focus:border-burgundy-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Fee Protection */}
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">Fee Protection</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center justify-end">
                        <span className="mr-1.5 font-mono text-[11px] font-bold text-text-muted">SGD</span>
                        <input
                          type="number"
                          min={0}
                          value={activeScheme.feeProtection}
                          onChange={(e) => handleFeeAmountChange("feeProtection", e.target.value)}
                          onBlur={() => { void persistCourseData(requirements, feeSchemes); }}
                          className="w-28 rounded-lg border border-brand-border bg-brand-bg/40 px-2.5 py-1 text-right font-mono text-xs font-semibold text-text-primary transition-all focus:border-burgundy-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Uniform Fee */}
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">Uniform Fee</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center justify-end">
                        <span className="mr-1.5 font-mono text-[11px] font-bold text-text-muted">SGD</span>
                        <input
                          type="number"
                          min={0}
                          value={activeScheme.uniformFee}
                          onChange={(e) => handleFeeAmountChange("uniformFee", e.target.value)}
                          onBlur={() => { void persistCourseData(requirements, feeSchemes); }}
                          className="w-28 rounded-lg border border-brand-border bg-brand-bg/40 px-2.5 py-1 text-right font-mono text-xs font-semibold text-text-primary transition-all focus:border-burgundy-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Admin Fee */}
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-text-primary">Admin Fee</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center justify-end">
                        <span className="mr-1.5 font-mono text-[11px] font-bold text-text-muted">SGD</span>
                        <input
                          type="number"
                          min={0}
                          value={activeScheme.adminFee}
                          onChange={(e) => handleFeeAmountChange("adminFee", e.target.value)}
                          onBlur={() => { void persistCourseData(requirements, feeSchemes); }}
                          className="w-28 rounded-lg border border-brand-border bg-brand-bg/40 px-2.5 py-1 text-right font-mono text-xs font-semibold text-text-primary transition-all focus:border-burgundy-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Subtotal */}
                  <tr className="border-t-2 border-brand-border bg-brand-bg/40 font-bold">
                    <td className="px-4 py-2.5 text-text-primary">Subtotal</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-text-primary">{subtotal.toFixed(2)}</td>
                  </tr>

                  {/* GST (9%) */}
                  <tr className="bg-brand-bg/40 font-bold">
                    <td className="px-4 py-2.5 text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <span>GST (9%)</span>
                        <span className="text-[10px] font-normal text-text-muted">on SGD {subtotal.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-text-secondary">{gstAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Fee Payable Executive Summary Box */}
            <div className="shadow-2xs mt-3 overflow-hidden rounded-xl border border-brand-red/30 bg-gradient-to-r from-brand-light-red/60 via-brand-light-pink to-brand-bg p-3.5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-brand-red" />
                    <span className="text-xs font-extrabold uppercase tracking-wide text-brand-red">Total Fee Payable</span>
                  </div>
                  <p className="text-[11px] text-text-muted">Inclusive of 9% Singapore GST ({activeScheme.schemeCode})</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-lg font-black tracking-tight text-brand-red">SGD {totalFeePayable.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Bottom: Delete Fee Type Button */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-text-muted">
                {feeSchemes.length} active {feeSchemes.length === 1 ? "scheme" : "schemes"} configured
              </span>
              <button
                type="button"
                onClick={() => setIsDeleteFeeTypeModalOpen(true)}
                disabled={feeSchemes.length <= 1}
                className="shadow-xs group inline-flex items-center gap-1.5 rounded-xl border border-brand-red/30 bg-brand-light-red px-3.5 py-2 text-xs font-bold text-brand-red transition-all duration-150 hover:border-brand-red hover:bg-brand-red hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                title={feeSchemes.length <= 1 ? "At least one scheme is required" : "Delete current fee type scheme"}
              >
                <Trash2 className="h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-110" />
                <span>Delete Fee Type</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Add Fee Type Modal Component */}
      {isAddFeeTypeModalOpen && (
        <AddFeeTypeModal
          isOpen={isAddFeeTypeModalOpen}
          onClose={() => setIsAddFeeTypeModalOpen(false)}
          onAddScheme={handleAddFeeScheme}
        />
      )}

      {/* Delete Fee Scheme Confirmation Modal */}
      {isDeleteFeeTypeModalOpen && (
        <DeleteModal
          isOpen={isDeleteFeeTypeModalOpen}
          onClose={() => setIsDeleteFeeTypeModalOpen(false)}
          onConfirm={handleDeleteActiveFeeType}
          title="Delete Fee Type"
          description={`Are you sure you want to delete the fee scheme "${activeScheme?.name}"?`}
          confirmText="Delete Fee Type"
        />
      )}

      {/* Add Requirement Modal Component */}
      {isAddRequirementModalOpen && (
        <AddRequirementModal
          isOpen={isAddRequirementModalOpen}
          onClose={() => setIsAddRequirementModalOpen(false)}
          mode="edit"
          initialValue={requirements.map(row => row.description).join("\n")}
          onAddRequirement={handleEditRequirements}
        />
      )}
    </motion.div>
  );
};

export default CourseDetailPage;
