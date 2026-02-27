# Swasthya Sanchar — Roles, Flows, Features & Data

This document clarifies **who the roles are**, **what each flow and feature does**, **what each role can and cannot do**, and **what data is stored and how sharing works**. Use it to verify route structure, TypeScript types, and frontend logic.

**Decentralised stack (per ARCHITECTURE.md):** The system uses **only** deployed **blockchain**, **user device**, and **Helia (IPFS) in the browser** — **no third-party services**, no central server, no server-side pinning. Helia runs in the client; all pinning/fetch is from the browser. Each party (patient, doctor, hospital) **sees only what they need**. **Family vs guardian:** Family = sharing (journey/records); guardian = recovery only. Family can be guardians; guardian does not grant family sharing. Only family get recovery access; medical data can be shared with friends, but recovery cannot. **"Check up done"** can be marked only by the **doctor department-wise allotted to that patient** — not by patient, hospital, or any other doctor. **Unconscious:** When patient is unconscious, doctor/surgeon gets access with **proof** (2 staff co-sign) so they can view medical docs/timeline and operate; **first responder (emergency contact) is notified**; first responder and emergency contact **can be family**; each has a **relation** attribute. **Hospital staff titles:** Doctor, Surgeon, Nurse, Consultant, Resident, etc. (IdentityRegistry optional title). ICE notifications may use Fast2SMS (acceptable). See **docs/DATA_STORAGE_AND_JOURNEY.md** for storage, journey, unconscious flow, relation, and titles.

---

## 1. Total roles

| Role | Where defined | Description |
|------|----------------|-------------|
| **Patient** | `crypto-identity.ts` (`Role`), `IdentityRegistry.sol`, Auth, UI | Person who owns health records; controls all access. |
| **Doctor** | Same as above | Clinician who can search patients, request/view/upload records (when granted). |
| **Hospital** | `IdentityRegistry.sol`, `crypto-identity.ts` (`Role`) | Separate entity; uploads clinical files for patients (ARCHITECTURE). |
| **Family / Guardian** | Not a separate role | **Family** = sharing (journey/records); **guardian** = recovery only. Family can be guardians; guardian does not grant family sharing. Only family get recovery access; medical data can be shared with friends, not recovery. No separate login role. |
| **Emergency** | Not a login role | Public viewer of Tier-0 emergency page via `/emergency/[address]` (no auth). |

**Important:**  
- **Login/registration roles** in the app today: **Patient** and **Doctor** only (see `page.tsx` signup: `signupRole: "patient" \| "doctor"`).  
- **Hospital** exists in contracts and types but has **no signup path** and **no nav/redirect** in the current frontend.
- **Family/guardian:** Patient links family members (who are patients or contacts) to help each other; no separate "guardian role" — just a **relationship** (patient → linked family for recovery + optional help).  
- **Emergency** in `src/lib/types.ts` as `UserRole` is misleading — it’s a **viewer context**, not a logged-in role.

---

## 2. Flows per role

### 2.1 Patient flow

| Step | Route / action | What happens |
|------|----------------|--------------|
| Register | `/` → Sign up (modal) → role = patient | Email/phone + password; identity created; optional on-chain register. |
| Login | `/` or `/auth/login` → Login (modal) | Email/phone + password (or biometric if set). |
| Post-login redirect | `page.tsx` | `role === "patient"` → **`/patient/home`**. |
| Home | **`/patient/home`** (or `/patient/patient-portal/home` redirects to patient home) | Dashboard; can also land on `/patient` (portal/profile). |
| Profile / portal | `/patient` (patient page = “My Portal”) | Full profile (demographics, emergency contact, vitals, medical info, emergency QR). Data from `/api/patient/status` + optional `localStorage`. |
| Records | `/patient/records` | List/manage own records (API: `GET /api/records` → currently returns `[]`). |
| Upload | `/patient/upload` | Upload personal docs (API: `/api/patient/upload`). |
| Access / permissions | `/patient/access`, `/patient/permissions` | Grant/revoke per-document access to doctors. APIs: `POST /api/patient/grant-access`, `GET /api/patient/permissions` (stubs). |
| Emergency | `/patient/emergency` | Configure QR/NFC and emergency tiers. |
| Family | `/patient/family` | Add/remove guardians (social recovery). Patient **controls what family sees**: share journey on/off by default, share medical records on/off; can remove family anytime. |
| Share journey | Journey flow | Patient can share journey with **anyone** (link) and with **family**; family see only what patient allows (see DATA_STORAGE_AND_JOURNEY.md). |
| Audit | `/patient/audit` | Access log (who accessed what, when). |
| Download | `/patient/download` | Download all or specific records. |
| Journey | `/patient/journey`, `/patient/journey/start`, `/patient/journey/[id]` | Patient journey flows. |
| Register (extra) | `/patient/register` | Patient registration page. |

**Patient cannot:**  
- Search other patients.  
- Access doctor-only APIs or doctor portal.  
- Grant access to a non-verified clinician (enforced on-chain).

---

### 2.2 Doctor flow

| Step | Route / action | What happens |
|------|----------------|--------------|
| Register | `/` → Sign up (modal) → role = doctor | Email/phone + password + optional license; identity created. |
| Login | Same as patient. | |
| Post-login redirect | `page.tsx` | `role === "doctor"` → **`/doctor/home`** (canonical doctor dashboard). |
| Profile / onboarding | **`/doctor/portal`** | Complete profile (name, license, specialization, qualification, experience, hospital, location). Uses `GET/PUT /api/doctor/profile` (stubbed) + **client-data** when `NEXT_PUBLIC_USE_CLIENT_DATA=true`. |
| Portal home | **`/doctor/home`** | Doctor dashboard; search patient via `GET /api/doctor/search?q=` (or client-data stubs). `/doctor-portal/home` redirects to `/doctor/home`. |
| Patients | `/doctor/patients` or `/doctor-portal/patients` | List authorised patients; uses `GET /api/doctor/patients` (stubbed) or client-data. |
| Upload | `/doctor/upload` or `/doctor-portal/upload` | Upload clinical files for a patient; uses doctor/patients and upload APIs (stubbed) or client-data. |
| Voice | `/doctor/voice`, `/doctor/voice/[id]` (and `/doctor-portal/voice` redirects) | Voice command flows. |
| Settings | `/settings` | Shared with patient. |

**Doctor cannot:**  
- See any patient record without patient having granted access (per-record DEK).  
- Register as patient with same wallet (one identity per wallet in contract).  
- Bypass verification (HealthRegistry uses `IVerifier` for grant/request/addRecord by non-patient).

---

### 2.3 Hospital flow (contracts only; no full app flow)

| Step | Intended (ARCHITECTURE) | Current app |
|------|--------------------------|-------------|
| Register | Hospital role in IdentityRegistry | No signup option; role exists in contract + `Role` type. |
| Pages | `/hospital` (e.g. manage patients, bulk upload) | Pages exist: `/hospital/upload`, `/hospital/admin`, `/hospital/journey/[id]`. They use `GET /api/doctor/search` to find patients. |
| Nav / redirect | — | No hospital in NavBar; no post-login redirect for `role === "hospital"`. |

So: **hospital is partially implemented (pages + contract role)** but **not wired** into auth, signup, or global nav.

---

### 2.4 Emergency (public, no login)

| Step | Route | What happens |
|------|--------|--------------|
| View | `/emergency/[address]` | Public page; no auth. Shows Tier-0 (and optionally Tier-1) emergency profile for `address` (e.g. from QR/NFC). Data from ZeroNet/emergency profile logic + optional cache. |

**Not a role:** “emergency” in `UserRole` in `src/lib/types.ts` should be treated as “viewer of emergency page”, not a logged-in role.

---

### 2.5 Family / Guardian (patients linking patients)

- **Not a separate role.** Family members are **patients** (or contacts). A patient links family so they can help each other (e.g. see journey, get recovery).  
- On-chain: patient adds guardian **wallets** (those wallets can belong to other patients); used for **social recovery** (e.g. 2 guardians approve → new Lock A).  
- No dedicated “guardian dashboard”; linking is done from patient flow (e.g. `/patient/family`).

---

## 3. Features per role (can / cannot)

| Feature | Patient | Doctor | Hospital (intended) | Emergency (viewer) |
|--------|---------|--------|----------------------|--------------------|
| Register / login | ✅ | ✅ | ❌ (no UI) | N/A |
| Own identity (wallet) on-chain | ✅ | ✅ | ✅ (contract) | N/A |
| Upload own records | ✅ | — | — | — |
| Upload records for a patient | — | ✅ (if verified) | ✅ (ARCHITECTURE) | — |
| View own records | ✅ | — | — | — |
| View patient records | — | ✅ only if granted per record | — | — |
| Grant/revoke access (per document) | ✅ | — | — | — |
| Request access (on-chain) | — | ✅ | — | — |
| Search patient (by email/phone) | — | ✅ | ✅ (reuses doctor search) | — |
| Emergency Tier-0 profile (public) | Configure ✅ | — | — | View ✅ |
| Emergency Tier-1 (break-glass) | Configure ✅ | Use ✅ (verified) | — | — |
| Unconscious protocol (Tier-2) | Opt-in, veto ✅ | — | Co-sign ✅ | — |
| Add guardians / social recovery | ✅ | — | — | — |
| Share journey with anyone/family; control what family sees (journey on/off, records on/off, remove family) | ✅ | — | — | — |
| Doctor verification (license) | — | Submit ✅, verified by admin/IVerifier | — | — |
| Profile (demographics, etc.) | ✅ `/api/patient/status` + update | ✅ Expected `/api/doctor/profile` (missing) | — | — |

---

## 4. Data stored and how sharing works

### 4.1 Identity (who exists)

| Data | Where stored | Who can see |
|------|--------------|-------------|
| Identifier (email/phone hash) | IdentityRegistry (on-chain) | Only hash; no plaintext on-chain. |
| Lock A / Lock C CIDs | IdentityRegistry (on-chain) | Public CIDs; content encrypted. |
| Wallet address | IdentityRegistry, AuthContext | User self; doctor search returns patient wallet for “request access”. |
| Role (patient/doctor/hospital) | IdentityRegistry, AuthContext session | App and contract. |
| Title (optional: Doctor, Surgeon, Nurse, etc.) | IdentityRegistry | Optional clinician title for display and Unconscious Protocol co-sign; set via setTitle(). |
| License hash (doctors) | IdentityRegistry | On-chain; verification via IVerifier. |
| Guardians | IdentityRegistry | Patient’s guardian list (addresses). |

**Session (frontend):**  
- AuthContext holds `UnlockedIdentity` (wallet, role, identifier).  
- No server-side session store; “session” is client-side unlock + Lock B on device.

---

### 4.2 Health records and access

| Data | Where stored | Who can see |
|------|--------------|-------------|
| Record metadata (patient, uploader, fileCid, fileType, timestamp) | HealthRegistry (on-chain) | Patient always; doctor/hospital only for records they’re allowed to access (logic via events + manifest). |
| File content | IPFS (encrypted with DEK) | Only those with DEK (patient + grantees per record). |
| DEK (per record) | Off-chain: encrypted per grantee, CID in AccessGranted event; patient’s manifest on IPFS | Patient; each grantee has own encrypted DEK. |
| accessManifestCid | HealthRegistry (one per patient) | Patient updates it on grant/revoke; contract stores only CID. |
| patientRecords[], emergencyRecords[] | HealthRegistry | Patient’s record IDs; emergency list for Tier-1. |
| accessRequested | HealthRegistry | Tracks which clinician requested which patient. |

**How sharing works (short):**  
1. Patient encrypts file with a **DEK**, stores ciphertext on IPFS.  
2. Patient encrypts **DEK** with each grantee’s public key and stores that on IPFS; emits **AccessGranted(recordId, grantee, encDekIpfsCid)**.  
3. Patient updates **accessManifestCid** (single CID for whole manifest).  
4. Doctor with access: fetches their encrypted DEK (from event/IPFS), decrypts with private key, then decrypts file from IPFS.  
5. **Revoke:** patient updates manifest (remove grantee’s DEK), re-pins, calls **revokeAccess(recordId, grantee, newManifestCid)**.

So: **data is stored** in IdentityRegistry + HealthRegistry (metadata + CIDs) and IPFS (encrypted files + encrypted DEKs). **Sharing = giving the grantee an encrypted DEK** and recording it in events/manifest; **no raw data on-chain**.

---

### 4.3 Patient profile (app layer)

| Data | Where stored | API / source |
|------|--------------|--------------|
| Demographics, emergency contact, vitals, medical info | Backend DB or stub | `GET /api/patient/status` (currently stub); `POST /api/patient/update`. |
| Emergency contact (name, phone, **relation**) | Same | **Relation** attribute: Spouse, Parent, Child, Sibling, Guardian, Friend, Other family, Other. Emergency contact **can be family**. |
| First responder(s) | Same / emergency profile | Person(s) notified when Unconscious Protocol or break-glass is used. **Default:** emergency contact. Patient can add more (name, phone, relation). **First responder can be family.** |
| Optional local override | `localStorage` key `patient_profile_${wallet}` | Merged in patient portal. |

Current **patient/status** returns a stub (no DB); frontend can still show form and use localStorage.

---

### 4.4 Doctor profile (app layer)

| Data | Where stored | API / source |
|------|--------------|--------------|
| Name, **title** (Doctor/Surgeon/Nurse/etc.), license, specialization, qualification, experience, hospital, **hospitalId**, **departmentIds**, city, state, **availability**, profile picture | Expected backend | **GET/POST `/api/doctor/profile`** (stubbed in `src/app/api/doctor/profile/route.ts`). |

Doctor registration (`/doctor/register`) and **Doctor** in `src/lib/types.ts` align: **name**, **title** (ClinicianTitle), **specialty** (form sends specialization), **hospitalId**, **departmentIds**, **availability**. Frontend sends these so a real backend can persist them.

---

### 4.5 Journey and other APIs

- **Journey:** `POST/GET /api/journey`, `GET /api/journey/[id]`, share route — used by patient/journey and hospital/journey.  
- **Hospitals:** `GET /api/hospitals`.  
- **Records:** `GET /api/records` (returns `[]`).  
- **AI:** `POST /api/ai/health-insights`.  
- **Emergency notify:** `POST /api/emergency/notify` or `/api/notify`.  
- **IPFS:** `/api/ipfs/upload`, `/api/ipfs/fetch/[cid]`.  
- **Auth:** `POST /api/auth/register-on-chain`.

---

## 5. Route and type inconsistencies to verify

Use this section when **verifying structure of each role and logic in routes/TypeScript/frontend**.

### 5.1 Role types

- **`src/lib/crypto-identity.ts`:** `Role = "patient" | "doctor" | "hospital"`.  
- **`src/lib/types.ts`:** `UserRole = 'patient' | 'doctor' | 'emergency'`.  
- **Recommendation:** Align `UserRole` with login roles only; treat “emergency” as viewer context, not a role. Add “hospital” to `UserRole` if you add hospital signup.

### 5.2 Duplicate route trees

- **Patient:** `/patient/home` vs `/patient/patient-portal/home`; `/patient` is full “My Portal” profile.  
- **Doctor:** `/doctor` (profile/onboarding) vs `/doctor-portal/*` vs `/doctor/doctor-portal/*`.  
- **Canonical paths (current code):** Patient home **`/patient/home`**; Doctor home **`/doctor/home`**; Doctor profile **`/doctor/portal`**. `/doctor-portal/home` redirects to `/doctor/home`.

### 5.3 API routes (frontend)

- **Doctor:** `GET/PUT /api/doctor/profile` (stubbed); search, patients, dashboard, upload — stubbed or **client-data** when `NEXT_PUBLIC_USE_CLIENT_DATA=true`.
- **Hospitals:** List → **`GET /api/hospitals-list`**; journeys → `GET /api/hospitals/[id]/journeys`.

### 5.4 NavBar and profile dropdown

- **NavBar:** Patient links: **`/patient/home`**, family, emergency, records, permissions. Doctor links: **`/doctor/home`**, patients, upload, voice.  
- **Profile dropdown:** Doctor → **`/doctor/home`**; Patient → **`/patient/home`**.

### 5.5 Post-login redirect (`page.tsx`)

- Patient → **`/patient/home`**.  
- Doctor → **`/doctor/home`**.  
- Hospital → **`/hospital/home`** (e.g. when using dev bypass with hospital role).

---

## 6. Summary table

| Role | Can do | Cannot do | Main data |
|------|--------|-----------|-----------|
| **Patient** | Own records, grant/revoke access, emergency config, family/guardians, audit, upload | See other patients’ data, doctor-only APIs | Identity + records + manifest (on-chain + IPFS); profile (API + optional localStorage) |
| **Doctor** | Search patient (email/phone), request access, view/upload when granted, break-glass when verified | See records without grant, patient-only APIs | Identity; access via DEKs from events + IPFS; profile (API stubbed + client-data) |
| **Hospital** | Contract: same as doctor for uploads; app: only existing hospital pages | No signup/nav/redirect in app | Same as doctor for records; no profile API |
| **Guardian** | Social recovery (on-chain); same as patient when linked | Login as separate role, see records | Guardian list (IdentityRegistry); they are patients linked by patient |
| **Emergency** | View Tier-0 (and Tier-1) page by address | Login, change data | Public emergency profile (and optional cache) |

After you align types, routes, and APIs with this doc, we can verify each role’s structure and the logic in routes and frontend step by step.

**See also:** [docs/DATA_STORAGE_AND_JOURNEY.md](./DATA_STORAGE_AND_JOURNEY.md) for: where data is stored (device vs blockchain vs server when deployed), journey flow and where journey data goes, queue as token number (e.g. 112), patient dequeue and doctor "check up done", department–doctor matching, OPD schedule, hospital features, field alignment, frontend coverage per role, and full patient–doctor–hospital data cycle.
