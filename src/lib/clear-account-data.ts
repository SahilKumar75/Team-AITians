/**
 * Clears all Swasthya Sanchar account data from this device (localStorage + IndexedDB).
 * Use for "Delete my account" – there is no central server database; this removes the
 * account from the current browser only. On-chain identity (Polygon) is not removed.
 */

const LOCAL_STORAGE_PREFIXES: string[] = [
  "swasthya_identity_store",
  "swasthya_recovery:",
  "swasthya-accessibility",
  "swasthya_emergency_tiers_",
  "swathya_patient_profile_",
  "swathya_doctor_profile_",
  "swathya_journeys_",
  "swathya_user_language",
  "swathya_voice_notes_",
  "patient_profile_",
  "doctor_profile_",
  "hospital_profile",
  "hospital_linked_id",
  "dev-bypass-role",
  "emergency_",
  "wallet_disconnected",
];

const LOCAL_STORAGE_KEYS_EXACT: string[] = [
  "theme",
  "language",
];

const INDEXED_DB_NAMES: string[] = [
  "swasthya-local",
  "swathya-helia-blocks",
  "swathya-helia-data",
  "swasthya-device",
];

function clearLocalStorage(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const matchPrefix = LOCAL_STORAGE_PREFIXES.some((p) => key === p || key.startsWith(p));
    const matchExact = LOCAL_STORAGE_KEYS_EXACT.includes(key);
    if (matchPrefix || matchExact) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => window.localStorage.removeItem(k));
}

function deleteIndexedDB(name: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve();
      return;
    }
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/**
 * Clears all app account data from this device (localStorage + IndexedDB), then signs out.
 * Call logout() and redirect after this.
 */
export async function clearAllAccountData(): Promise<void> {
  clearLocalStorage();
  await Promise.all(INDEXED_DB_NAMES.map(deleteIndexedDB));
}
