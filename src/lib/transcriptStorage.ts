import { get, set, del, keys } from 'idb-keyval';

export interface TranscriptRecord {
  id: string;
  clientName: string;
  sessionDate: string;
  content: string;
  createdAt: number;
  engine: "gemini" | "gemini-pro" | "whisper" | string;
  isDeleted?: boolean;
  deletedAt?: number;
}

const STORAGE_PREFIX = "hana_transcript_";

export async function cleanupTrash(): Promise<void> {
  const allKeys = await keys();
  const transcriptKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(STORAGE_PREFIX));
  
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  for (const key of transcriptKeys) {
    const record = await get<TranscriptRecord>(key as string);
    if (record && record.isDeleted && record.deletedAt) {
      if (now - record.deletedAt > thirtyDaysInMs) {
        await del(key as string); // Perm delete
      }
    }
  }
}

export async function saveTranscript(record: TranscriptRecord): Promise<void> {
  await set(`${STORAGE_PREFIX}${record.id}`, record);
}

export async function getTranscript(id: string): Promise<TranscriptRecord | undefined> {
  return await get(`${STORAGE_PREFIX}${id}`);
}

export async function moveToTrash(id: string): Promise<void> {
  const record = await getTranscript(id);
  if (record) {
    record.isDeleted = true;
    record.deletedAt = Date.now();
    await saveTranscript(record);
  }
}

export async function restoreTranscript(id: string): Promise<void> {
  const record = await getTranscript(id);
  if (record) {
    record.isDeleted = false;
    record.deletedAt = undefined;
    await saveTranscript(record);
  }
}

export async function deleteTranscriptPerm(id: string): Promise<void> {
  await del(`${STORAGE_PREFIX}${id}`);
}

// Deprecated alias for backwards compatibility
export const deleteTranscript = moveToTrash;

export async function getAllTranscripts(includeDeleted = false): Promise<TranscriptRecord[]> {
  await cleanupTrash();
  const allKeys = await keys();
  const transcriptKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(STORAGE_PREFIX));
  
  const records: TranscriptRecord[] = [];
  for (const key of transcriptKeys) {
    const record = await get<TranscriptRecord>(key as string);
    if (record) {
      if (includeDeleted || !record.isDeleted) {
        records.push(record);
      }
    }
  }
  
  // Sort descending by creation
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDeletedTranscripts(): Promise<TranscriptRecord[]> {
  await cleanupTrash();
  const allKeys = await keys();
  const transcriptKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(STORAGE_PREFIX));
  
  const records: TranscriptRecord[] = [];
  for (const key of transcriptKeys) {
    const record = await get<TranscriptRecord>(key as string);
    if (record && record.isDeleted) {
      records.push(record);
    }
  }
  
  return records.sort((a, b) => (b.deletedAt || b.createdAt) - (a.deletedAt || a.createdAt));
}

export function generateTranscriptId(): string {
  return "tr_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
