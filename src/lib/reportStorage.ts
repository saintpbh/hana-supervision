import { ReportFormData, INITIAL_FORM_DATA } from "@/types/report";
import { get, set } from "idb-keyval";

export interface SavedReportVersion {
  reportContent: string;
  referenceContent?: string;
  createdAt: string;
}

export interface SavedReport {
  id: string;
  title: string;
  formData: ReportFormData;
  reportContent: string;
  referenceContent?: string;
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

export async function cleanupTrash(): Promise<void> {
  try {
    const raw = await get<SavedReport[]>(STORAGE_KEY);
    if (!raw) return;
    let reports = raw;
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
      await set(STORAGE_KEY, reports);
    }
  } catch {
    // Ignore errors
  }
}

export async function getAllReports(includeDeleted = false): Promise<SavedReport[]> {
  if (typeof window === "undefined") return [];
  await cleanupTrash();
  try {
    let reports = await get<SavedReport[]>(STORAGE_KEY);
    if (!reports) {
      // Migration from localStorage if idb is empty
      const oldRaw = localStorage.getItem(STORAGE_KEY);
      if (oldRaw) {
        reports = JSON.parse(oldRaw);
        await set(STORAGE_KEY, reports);
        localStorage.removeItem(STORAGE_KEY); // Clean up old storage to free 5MB block
      } else {
        return [];
      }
    }
    
    const validReports = reports || [];

    if (!includeDeleted) {
      return validReports.filter(r => !r.isDeleted).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    
    return validReports.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function getDeletedReports(): Promise<SavedReport[]> {
  if (typeof window === "undefined") return [];
  await cleanupTrash();
  try {
    let reports = await get<SavedReport[]>(STORAGE_KEY);
    if (!reports) return [];
    reports = reports.filter(r => !!r.isDeleted);
    return reports.sort(
      (a, b) => new Date(b.deletedAt || b.updatedAt).getTime() - new Date(a.deletedAt || a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function getReport(id: string): Promise<SavedReport | null> {
  const reports = await getAllReports(true);
  return reports.find((r) => r.id === id) ?? null;
}

export async function saveReport(
  id: string | null,
  formData: ReportFormData,
  reportContent: string,
  referenceContent?: string,
  saveAsVersion = false
): Promise<SavedReport> {
  const reports = await getAllReports(true);
  const now = new Date().toISOString();
  const title = generateTitle(formData);

  if (id) {
    const idx = reports.findIndex((r) => r.id === id);
    if (idx >= 0) {
      const existing = reports[idx];
      
      let newVersions = existing.versions || [];
      // Only push to versions explicitly when requested (e.g. at Generation)
      if (saveAsVersion && existing.reportContent) {
        newVersions = [{ reportContent: existing.reportContent, referenceContent: existing.referenceContent, createdAt: existing.updatedAt }, ...newVersions];
      }

      const updatedReport = {
        ...existing,
        title,
        formData,
        reportContent,
        referenceContent: referenceContent ?? existing.referenceContent,
        updatedAt: now,
        versions: newVersions,
        isDeleted: false,
        deletedAt: undefined
      };
      reports[idx] = updatedReport;
      await set(STORAGE_KEY, reports);
      return updatedReport;
    }
  }

  // Create new
  const newReport: SavedReport = {
    id: id || generateId(),
    title,
    formData,
    reportContent,
    referenceContent,
    createdAt: now,
    updatedAt: now,
    versions: []
  };
  reports.unshift(newReport);
  await set(STORAGE_KEY, reports);
  return newReport;
}

export async function moveToTrash(id: string): Promise<void> {
  const reports = await getAllReports(true);
  const idx = reports.findIndex(r => r.id === id);
  if (idx >= 0) {
    reports[idx].isDeleted = true;
    reports[idx].deletedAt = new Date().toISOString();
    await set(STORAGE_KEY, reports);
  }
}

export async function restoreReport(id: string): Promise<void> {
  const reports = await getAllReports(true);
  const idx = reports.findIndex(r => r.id === id);
  if (idx >= 0) {
    reports[idx].isDeleted = false;
    reports[idx].deletedAt = undefined;
    await set(STORAGE_KEY, reports);
  }
}

export async function deleteReportPerm(id: string): Promise<void> {
  const reports = (await getAllReports(true)).filter((r) => r.id !== id);
  await set(STORAGE_KEY, reports);
}

// Deprecated alias for backwards compatibility
export const deleteReport = moveToTrash;

export async function createNewReport(): Promise<SavedReport> {
  return await saveReport(null, INITIAL_FORM_DATA, "");
}
