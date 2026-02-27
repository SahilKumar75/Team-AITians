"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "swathya_sanchar_offline";
const STORE_NAME = "decrypted_records";
const DB_VERSION = 1;

interface DecryptedRecord {
    id: string; // CID or recordId
    blob: Blob;
    mimeType: string;
    metadata: any;
    savedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "id" });
                }
            },
        });
    }
    return dbPromise;
}

/**
 * Save a decrypted record to IndexedDB.
 */
export async function saveRecordOffline(
    id: string,
    blob: Blob,
    mimeType: string,
    metadata: any = {}
) {
    try {
        const db = await getDB();
        await db.put(STORE_NAME, {
            id,
            blob,
            mimeType,
            metadata,
            savedAt: Date.now(),
        });
        console.log(`Record ${id} saved offline.`);
    } catch (err) {
        console.error("Failed to save record offline:", err);
    }
}

/**
 * Retrieve a decrypted record from IndexedDB.
 */
export async function getOfflineRecord(id: string): Promise<DecryptedRecord | null> {
    try {
        const db = await getDB();
        return (await db.get(STORE_NAME, id)) || null;
    } catch (err) {
        console.error("Failed to fetch offline record:", err);
        return null;
    }
}

/**
 * Delete a specific record from offline storage.
 */
export async function deleteOfflineRecord(id: string) {
    try {
        const db = await getDB();
        await db.delete(STORE_NAME, id);
    } catch (err) {
        console.error("Failed to delete offline record:", err);
    }
}

/**
 * Get all offline record IDs.
 */
export async function getAllOfflineRecordIds(): Promise<string[]> {
    try {
        const db = await getDB();
        return await db.getAllKeys(STORE_NAME) as string[];
    } catch (err) {
        console.error("Failed to get all offline record IDs:", err);
        return [];
    }
}
