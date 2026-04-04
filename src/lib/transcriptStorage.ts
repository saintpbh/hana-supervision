import { get, set, del, keys } from 'idb-keyval';

export interface TranscriptRecord {
  id: string;
  clientName: string;
  sessionDate: string;
  content: string;
  createdAt: number;
  engine: "gemini" | "whisper";
}

const STORAGE_PREFIX = "hana_transcript_";

export async function saveTranscript(record: TranscriptRecord): Promise<void> {
  await set(`${STORAGE_PREFIX}${record.id}`, record);
}

export async function getTranscript(id: string): Promise<TranscriptRecord | undefined> {
  return await get(`${STORAGE_PREFIX}${id}`);
}

export async function deleteTranscript(id: string): Promise<void> {
  await del(`${STORAGE_PREFIX}${id}`);
}

export async function getAllTranscripts(): Promise<TranscriptRecord[]> {
  const allKeys = await keys();
  const transcriptKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(STORAGE_PREFIX));
  
  const records: TranscriptRecord[] = [];
  for (const key of transcriptKeys) {
    const record = await get(key as string);
    if (record) {
      records.push(record as TranscriptRecord);
    }
  }
  
  // Sort descending by creation
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export function generateTranscriptId(): string {
  return "tr_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
