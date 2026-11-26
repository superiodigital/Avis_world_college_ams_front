import type { CollegeIntake } from "./types";

function dateInput(value?: string): string {
  if (!value) return "";
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);
  if (iso) return iso[1];
  const numeric = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (numeric) return `${numeric[3]}-${numeric[2]}-${numeric[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

export function intakeSchedule(intake?: CollegeIntake) {
  return {
    intakeMonth: intake?.intakeMonth || "",
    intakeDate: dateInput(intake?.intakeDate || intake?.commenceDate),
    finalExamResultDate: dateInput(intake?.finalExamResultDate),
    confermentDate: dateInput(intake?.confermentDate),
    completionDate: dateInput(intake?.completionDate),
  };
}
