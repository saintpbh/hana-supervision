import { ReportFormData, INITIAL_FORM_DATA } from "@/types/report";

export interface SavedReportVersion {
  reportContent: string;
  createdAt: string;
}

export interface SavedReport {
  id: string;
  title: string;
  formData: ReportFormData;
  reportContent: string;
  createdAt: string;
  updatedAt: string;
  versions?: SavedReportVersion[];
  isDeleted?: boolean;
  deletedAt?: string;
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

export function cleanupTrash(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let reports: SavedReport[] = JSON.parse(raw);
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    let hasChanges = false;
    reports = reports.filter(r => {
      if (r.isDeleted && r.deletedAt) {
        if (now - new Date(r.deletedAt).getTime() > thirtyDaysInMs) {
          hasChanges = true;
          return false; // Permanently delete
        }
      }
      return true;
    });
    
    if (hasChanges) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    }
  } catch {
    // Ignore errors
  }
}

export function getAllReports(includeDeleted = false): SavedReport[] {
  if (typeof window === "undefined") return [];
  cleanupTrash();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let reports: SavedReport[] = JSON.parse(raw);
    
    if (!includeDeleted) {
      reports = reports.filter(r => !r.isDeleted);
    }
    
    return reports.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function getDeletedReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  cleanupTrash();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let reports: SavedReport[] = JSON.parse(raw);
    reports = reports.filter(r => !!r.isDeleted);
    return reports.sort(
      (a, b) => new Date(b.deletedAt || b.updatedAt).getTime() - new Date(a.deletedAt || a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function getReport(id: string): SavedReport | null {
  const reports = getAllReports(true);
  return reports.find((r) => r.id === id) ?? null;
}

export function saveReport(
  id: string | null,
  formData: ReportFormData,
  reportContent: string,
  saveAsVersion = false
): SavedReport {
  const reports = getAllReports(true);
  const now = new Date().toISOString();
  const title = generateTitle(formData);

  if (id) {
    const idx = reports.findIndex((r) => r.id === id);
    if (idx >= 0) {
      const existing = reports[idx];
      
      let newVersions = existing.versions || [];
      // Only push to versions explicitly when requested (e.g. at Generation)
      if (saveAsVersion && existing.reportContent) {
        newVersions = [{ reportContent: existing.reportContent, createdAt: existing.updatedAt }, ...newVersions];
      }

      reports[idx] = {
        ...existing,
        title,
        formData,
        reportContent,
        updatedAt: now,
        versions: newVersions,
        isDeleted: false,
        deletedAt: undefined
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
    versions: []
  };
  reports.unshift(newReport);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  return newReport;
}

export function moveToTrash(id: string): void {
  const reports = getAllReports(true);
  const idx = reports.findIndex(r => r.id === id);
  if (idx >= 0) {
    reports[idx].isDeleted = true;
    reports[idx].deletedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  }
}

export function restoreReport(id: string): void {
  const reports = getAllReports(true);
  const idx = reports.findIndex(r => r.id === id);
  if (idx >= 0) {
    reports[idx].isDeleted = false;
    reports[idx].deletedAt = undefined;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  }
}

export function deleteReportPerm(id: string): void {
  const reports = getAllReports(true).filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

// Deprecated alias for backwards compatibility
export const deleteReport = moveToTrash;

export function createNewReport(): SavedReport {
  return saveReport(null, INITIAL_FORM_DATA, "");
}
