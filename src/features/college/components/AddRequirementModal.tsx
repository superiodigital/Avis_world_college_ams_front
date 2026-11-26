import React, { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { sanitizeInput } from "@/lib/security";
import { toast } from "@/components/common/ToastMessage";

export interface AddRequirementModalProps {
  isOpen: boolean;
  initialValue?: string;
  mode?: "add" | "edit";
  onClose: () => void;
  onAddRequirement: (description: string) => void | boolean | Promise<void | boolean>;
}

export const AddRequirementModal: React.FC<AddRequirementModalProps> = ({ isOpen, onClose, onAddRequirement, initialValue = "", mode = "add" }) => {
  const [requirementText, setRequirementText] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (isOpen) setRequirementText(initialValue); }, [isOpen, initialValue]);

  const handleClose = () => {
    setRequirementText("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = requirementText.trim();
    if (!trimmed && mode !== "edit") {
      toast.error("Please enter requirement details.");
      return;
    }

    if (saving) return;
    setSaving(true);
    try {
      if (await onAddRequirement(sanitizeInput(trimmed)) === false) return;
      setRequirementText("");
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === "edit" ? "Edit Course Requirements" : "Add Course Requirement"}
      subtitle={mode === "edit" ? "Update the saved criteria, one requirement per line" : "Add a new entry requirement criterion for this course"}
      headerIcon={<FileText className="h-5 w-5 text-burgundy-primary" />}
      maxWidth="md"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-3.5"
      >
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-primary">
            Requirement Description <span className="text-brand-red">*</span>
          </label>
          <textarea
            rows={4}
            required
            placeholder="e.g. Academic: Completed 10 years of Formal Education or Passed AceTek College's English Placement Test"
            value={requirementText}
            onChange={(e) => setRequirementText(e.target.value)}
            className="w-full rounded-xl border border-brand-border bg-white p-3 text-xs leading-relaxed text-text-primary transition-all placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-1 focus:ring-burgundy-primary"
          />
          <p className="mt-1 text-[11px] text-text-muted">
            Specify minimum age, academic qualification, language proficiency or industry experience.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-brand-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="rounded-xl border-brand-border text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            variant="burgundy"
            size="sm"
            className="rounded-xl text-xs font-semibold"
          >
            Add Requirement
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddRequirementModal;
