import type {CourseRequirement} from "@/features/college/types";
export function courseRequirements(description?: string, legacy: CourseRequirement[] = []): CourseRequirement[] {
  if (!description?.trim()) return legacy;
  const rows = description.split(/\r?\n/).map(text => text.trim()).filter(Boolean).map((description, index) => ({id: 'description-' + (index + 1), description}));
  const descriptions = new Set(rows.map(row => row.description));
  return [...rows, ...legacy.filter(row => row.description?.trim() && !descriptions.has(row.description.trim())).map((row, index) => ({...row, id: 'legacy-' + (row.id || index)}))];
}
