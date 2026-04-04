import { ReportFormData, INITIAL_FORM_DATA } from "@/types/report";

export interface SavedReport {
  id: string;
  title: string;
  formData: ReportFormData;
  reportContent: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "hana_reports";

function generateId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateTitle(formData: ReportFormData): string {
  const client = formData.clientProfile.clientCode;
  const session = formData.sessionSummary.sessionNumber;
  const counselor = formData.adminInfo.counselorName;
  if (client && session) return `${client} - ${session}`;
  if (client) return `${client}`;
  if (counselor) return `${counselor}의 보고서`;
  return "새 보고서";
}

export function getAllReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const reports: SavedReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function getReport(id: string): SavedReport | null {
  const reports = getAllReports();
  return reports.find((r) => r.id === id) ?? null;
}

export function saveReport(
  id: string | null,
  formData: ReportFormData,
  reportContent: string
): SavedReport {
  const reports = getAllReports();
  const now = new Date().toISOString();
  const title = generateTitle(formData);

  if (id) {
    const idx = reports.findIndex((r) => r.id === id);
    if (idx >= 0) {
      reports[idx] = {
        ...reports[idx],
        title,
        formData,
        reportContent,
        updatedAt: now,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
      return reports[idx];
    }
  }

  // Create new
  const newReport: SavedReport = {
    id: id || generateId(),
    title,
    formData,
    reportContent,
    createdAt: now,
    updatedAt: now,
  };
  reports.unshift(newReport);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  return newReport;
}

export function deleteReport(id: string): void {
  const reports = getAllReports().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function createNewReport(): SavedReport {
  return saveReport(null, INITIAL_FORM_DATA, "");
}
