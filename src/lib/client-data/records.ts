/**
 * Client-side records adapter backed by HealthRegistry only.
 * Used when NEXT_PUBLIC_USE_CLIENT_DATA=true.
 */
import { getPatientRecordIds, getRecordMetadata } from "@/lib/blockchain";

export interface RecordClient {
  id: string;
  fileCid: string;
  patient: string;
  uploader: string;
  fileType: string;
  timestamp: number;
  active: boolean;
}

export async function listRecordsClient(patientAddress?: string): Promise<{ records: RecordClient[] }> {
  if (!patientAddress) return { records: [] };
  const fromChain: RecordClient[] = [];
  try {
    const ids = await getPatientRecordIds(patientAddress);
    for (const id of ids) {
      const meta = await getRecordMetadata(id);
      if (meta && meta.active)
        fromChain.push({
          id,
          fileCid: meta.fileCid,
          patient: meta.patient,
          uploader: meta.uploader,
          fileType: meta.fileType,
          timestamp: meta.timestamp,
          active: meta.active,
        });
    }
  } catch {
    /* chain unavailable */
  }
  fromChain.sort((a, b) => b.timestamp - a.timestamp);
  return { records: fromChain };
}
