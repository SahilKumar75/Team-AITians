/**
 * Local-first cache (ARCHITECTURE.md). RxDB with Dexie storage for records/manifests.
 * Reactive queries and optional replication can be layered on top.
 */

import { createRxDatabase } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

const DB_NAME = "swasthya-local";

export interface RecordDoc {
  id: string;
  recordId: string;
  patientAddress: string;
  fileCid: string;
  fileType: string;
  uploadedAt: number;
  updatedAt: number;
}

export interface ManifestDoc {
  id: string;
  patientAddress: string;
  manifestCid: string;
  updatedAt: number;
}

const recordsSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    recordId: { type: "string", maxLength: 128 },
    patientAddress: { type: "string", maxLength: 64 },
    fileCid: { type: "string", maxLength: 128 },
    fileType: { type: "string", maxLength: 64 },
    uploadedAt: { type: "number" },
    updatedAt: { type: "number" },
  },
  required: ["id", "recordId", "patientAddress", "fileCid", "fileType", "uploadedAt", "updatedAt"],
} as const;

const manifestsSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 64 },
    patientAddress: { type: "string", maxLength: 64 },
    manifestCid: { type: "string", maxLength: 128 },
    updatedAt: { type: "number" },
  },
  required: ["id", "patientAddress", "manifestCid", "updatedAt"],
} as const;

let dbPromise: Promise<Awaited<ReturnType<typeof initDb>>> | null = null;

async function initDb() {
  const storage = getRxStorageDexie();
  const db = await createRxDatabase({
    name: DB_NAME,
    storage,
    multiInstance: false,
  });
  await db.addCollections({
    records: {
      schema: recordsSchema,
    },
    manifests: {
      schema: manifestsSchema,
    },
  });
  return { records: db.records, manifests: db.manifests };
}

async function getDb(): Promise<Awaited<ReturnType<typeof initDb>>> {
  if (typeof window === "undefined") throw new Error("local-db is browser only");
  if (!dbPromise) dbPromise = initDb();
  return dbPromise;
}

export async function putRecord(doc: RecordDoc): Promise<void> {
  if (typeof window === "undefined") return;
  const { records } = await getDb();
  const now = Date.now();
  await records.upsert({
    ...doc,
    updatedAt: now,
  });
}

export async function getRecordsByPatient(patientAddress: string): Promise<RecordDoc[]> {
  if (typeof window === "undefined") return [];
  const { records } = await getDb();
  const list = await records.find({
    selector: { patientAddress: { $eq: patientAddress } },
  }).exec();
  return list.map((d) => d.toJSON());
}

export async function putManifest(doc: ManifestDoc): Promise<void> {
  if (typeof window === "undefined") return;
  const { manifests } = await getDb();
  const now = Date.now();
  const id = doc.id || doc.patientAddress;
  await manifests.upsert({
    ...doc,
    id,
    updatedAt: now,
  });
}

export async function getManifest(patientAddress: string): Promise<ManifestDoc | null> {
  if (typeof window === "undefined") return null;
  const { manifests } = await getDb();
  const doc = await manifests.findOne({
    selector: { id: { $eq: patientAddress } },
  }).exec();
  return doc ? doc.toJSON() : null;
}
