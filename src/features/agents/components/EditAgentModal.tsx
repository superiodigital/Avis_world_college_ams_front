import React, { useState, useEffect, useRef, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { AgentItem } from "../types";
import { Edit3, Mail, Phone, Upload, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import countriesData from "@/data/country.json";
import { representatives } from "@/services/ams";
import { useApiCollection } from "@/hooks/useApiCollection";

export interface EditAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentItem | null;
  onSave: (updatedAgent: AgentItem) => void | boolean | Promise<void | boolean>;
}

export const EditAgentModal: React.FC<EditAgentModalProps> = ({
  isOpen,
  onClose,
  agent,
  onSave,
}) => {
  const { data: reps, loading: repsLoading, error: repsError, reload: reloadReps } = useApiCollection(representatives);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [representative, setRepresentative] = useState("");
  const [country, setCountry] = useState("India");
  const [status, setStatus] = useState<"Active" | "Inactive" | "Suspended">("Active");
  const [avatarUrl, setAvatarUrl] = useState("/avis-emblem.png");
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const representativeOptions: DropdownOption[] = useMemo(() => {

    if (reps.length === 0) {
      return [];
    }
    return reps.map((r) => ({
      label: `${r.name}${r.country ? ` (${r.country})` : ""}${reps.filter(rep => rep.name === r.name).length > 1 ? ` • ${r.email || r.id}` : ""}`,
      value: r.id,
    }));
  }, [reps]);

  const countryOptions: DropdownOption[] = useMemo(() => {
    return (countriesData as { name: string; code: string }[]).map((c) => ({
      label: c.name,
      value: c.name,
    }));
  }, []);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setEmail(agent.email);
      setPhone(agent.phone);
      setRepresentative(agent.representativeId || "");
      setCountry(agent.country);
      setStatus(agent.status);
      setAvatarUrl(agent.avatarUrl || "/avis-emblem.png");
      setError("");
    }
  }, [agent]);

  useEffect(() => {
    if (agent && !representative && !agent.representativeId && reps.length) {
      const matches = reps.filter(rep => rep.name === agent.representative);
      if (matches.length === 1) setRepresentative(matches[0].id);
    }
  }, [agent, representative, reps]);

  if (!agent) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Avatar file size must be less than 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        if (error) setError("");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter the Agent's Full Name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please provide a valid official Email.");
      return;
    }
    if (!phone.trim()) {
      setError("Please provide a Phone number.");
      return;
    }
    if (repsLoading || repsError || !reps.some(rep => rep.id === representative)) {
      setError("Please select an available Representative.");
      return;
    }
    if (!country.trim()) {
      setError("Please select a Country.");
      return;
    }

    const updated: AgentItem = {
      ...agent,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      type: agent.type,
      representative: reps.find(rep => rep.id === representative)?.name || "",
      representativeId: representative,
      country: country.trim(),
      status,
      avatarUrl,
    };

    if (await onSave(updated) === false) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <span>Edit Agent Details</span>
          <span className="rounded-full bg-burgundy-primary/10 px-2.5 py-0.5 text-xs font-bold text-burgundy-primary">
            {agent.agentCode}
          </span>
        </div>
      }
      subtitle={`Update agency credential, representative assignment, and contact details for ${agent.name}`}
      headerIcon={
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy-primary/10 text-burgundy-primary">
          <Edit3 className="h-5 w-5 stroke-[2.2]" />
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Profile Card */}
        <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-brand-border/80 bg-brand-bg/40 p-3.5">
          <div className="relative group shrink-0">
            <img
              src={avatarUrl}
              alt="Avatar Preview"
              className="h-16 w-16 rounded-full border-2 border-white object-cover shadow-sm ring-2 ring-brand-border"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/avis-emblem.png";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"
              title="Upload New Photo"
            >
              <Upload className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h4 className="text-xs font-bold text-text-primary">{name || "Agent Profile"}</h4>
            <p className="mt-0.5 font-mono text-[11px] text-text-muted">{agent.agentCode} • Joined {agent.joinedDate}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-brand-border bg-white px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:border-burgundy-primary hover:text-burgundy-primary"
              >
                Change Avatar
              </button>
              {avatarUrl !== "/avis-emblem.png" && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl("/avis-emblem.png")}
                  className="text-[11px] font-semibold text-brand-red hover:underline"
                >
                  Reset Default
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Full Name */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-text-secondary">
              Full Name <span className="text-brand-red">*</span>
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError("");
                }}
                className="w-full rounded-xl border border-brand-border bg-white py-2 pl-9 pr-3 text-xs font-medium text-text-primary placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-2 focus:ring-burgundy-primary/20"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-bold text-text-secondary">
              Email <span className="text-brand-red">*</span>
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                className="w-full rounded-xl border border-brand-border bg-white py-2 pl-9 pr-3 text-xs font-medium text-text-primary placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-2 focus:ring-burgundy-primary/20"
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1 block text-xs font-bold text-text-secondary">
              Phone <span className="text-brand-red">*</span>
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (error) setError("");
                }}
                className="w-full rounded-xl border border-brand-border bg-white py-2 pl-9 pr-3 text-xs font-medium text-text-primary placeholder:text-text-muted focus:border-burgundy-primary focus:outline-none focus:ring-2 focus:ring-burgundy-primary/20"
                required
              />
            </div>
          </div>

          {/* Representative */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-text-secondary">
              Representative <span className="text-brand-red">*</span>
            </label>
            <div className="w-full">
              <Dropdown
                value={representative}
                options={representativeOptions}
                placeholder={repsLoading ? "Loading representatives…" : "Select representative"}
                onChange={(val) => setRepresentative(val)}
                className="w-full"
                buttonClassName="w-full justify-between h-[36px] rounded-xl text-xs bg-white border border-brand-border"
                menuClassName="max-h-56 overflow-y-auto w-full z-50"
              />
            </div>
            {repsError && <p role="alert" className="mt-1 text-xs text-red-700">Unable to load representatives. <button type="button" onClick={() => void reloadReps()} className="underline">Retry</button></p>}
            {!repsLoading && !repsError && reps.length === 0 && <p className="mt-1 text-xs text-text-muted">No representatives found. Create a representative first.</p>}
          </div>

          {/* Country */}
          <div>
            <label className="mb-1 block text-xs font-bold text-text-secondary">
              Country <span className="text-brand-red">*</span>
            </label>
            <div className="w-full">
              <Dropdown
                value={country}
                options={countryOptions}
                onChange={(val) => {
                  setCountry(val);
                  if (error) setError("");
                }}
                className="w-full"
                buttonClassName="w-full justify-between h-[36px] rounded-xl text-xs bg-white border border-brand-border"
                menuClassName="max-h-56 overflow-y-auto w-full z-50"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-xs font-bold text-text-secondary">Status</label>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStatus("Active")}
                className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                  status === "Active"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-xs"
                    : "border-brand-border bg-white text-text-secondary hover:bg-brand-bg"
                }`}
              >
                ● Active
              </button>
              <button
                type="button"
                onClick={() => setStatus("Inactive")}
                className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                  status === "Inactive"
                    ? "border-amber-300 bg-amber-50 text-amber-700 shadow-xs"
                    : "border-brand-border bg-white text-text-secondary hover:bg-brand-bg"
                }`}
              >
                ○ Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-brand-border/70 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl px-4 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={repsLoading || Boolean(repsError) || !reps.some(rep => rep.id === representative)}
            variant="burgundy"
            size="sm"
            className="rounded-xl px-5 text-xs font-bold shadow-md shadow-burgundy/15"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            <span>Save Changes</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
