# Data storage, journey, hospital, and full cycle

Companion to **ROLES_AND_FLOWS.md** and **ARCHITECTURE.md**. This doc follows the **decentralised-only** design: **no third-party services**; only **deployed blockchain**, **user device**, and **Helia (IPFS)**. No central server database for user data or journey.

Covers: where data is stored (device / blockchain / Helia only), max 2 devices per account, **session vs visit** (full checkup/treatment spanning multiple visits and days), journey flow and queue (token number), **tests ordered** (when result available, queue for test), **hospital uploads report** to patient, **patient timeline** (when I went, which department, what doctor said, when test ready, report uploaded), least-access visibility, patient sharing with anyone and family, department–doctor matching, OPD schedule, and full cycle.

---

## 1. Where data is stored: device, blockchain, Helia only (no central server)

Per **ARCHITECTURE.md** the system uses **only**:

- **Deployed blockchain** (e.g. Polygon) — identity, access control, minimal pointers.
- **User device** — keys, Lock B, local cache (IndexedDB/RxDB, localStorage).
- **Helia (IPFS) in the browser** — **everything in the client**; no server that pins. Helia runs inside the app (client-side); encrypted blobs (Lock A/C, files, DEKs, optional profile/journey payloads) are published and fetched directly from the user’s browser. No Pinata or other third-party IPFS, and **no backend server that pins to IPFS**.

There is **no central server database** and **no server-side pinning**. Anything that must persist beyond one device lives on **blockchain** (metadata, access) or **Helia from the client** (encrypted content), with pointers/CIDs on-chain where needed.

### 1.1 On the user device (browser)

| Data | Where | Purpose |
|------|--------|--------|
| **Lock B** (encrypted private key with device key) | **IndexedDB** (`device-storage.ts`: store `lockB`) | Fast login on this device (biometric/WebAuthn). **Max 2 devices** per account (see below). |
| **Device key** | IndexedDB (same DB, store `deviceKey`) | Encrypt/decrypt Lock B. |
| **WebAuthn credential ID** | IndexedDB (store `webauthn`) | Biometric login on this device. |
| **Identity payload** (salt, iv, cipher, role, recovery cipher) | **localStorage** (`crypto-identity.ts`) | Password login; key = hash of identifier. |
| **Patient profile** (demographics, emergency, vitals) | **Local** (e.g. RxDB / localStorage) | Primary or cache; can also publish encrypted to Helia and store CID on-chain (e.g. emergencyCid). |
| **Emergency profile cache** | localStorage | Cache for `/emergency/[address]` (e.g. 7 days). |
| **Theme, language, accessibility** | localStorage | UI preferences. |

Nothing here is synced to a **central server**; at most the app talks to **blockchain RPC** and **Helia** (IPFS).

### 1.2 Max 2 devices per account (login and recovery)

- A user may link **at most 2 devices** for **login and password recovery** (Lock B).
- On a **third device**, the user can still log in with **email + password** (fetch Lock A from Helia, decrypt) or **recovery phrase** (Lock C from Helia), but **Lock B must not be stored** on that device (or the app must refuse to create Lock B when the account already has 2 devices).
- Implementation: either (a) store on-chain or on Helia a **list of at most 2 device identifiers** (e.g. public keys or hashes) and only allow Lock B creation if the current device is in that list or the list has &lt; 2 entries and the user explicitly “links this device”, or (b) enforce in the app by counting Lock B entries per identity (if Lock B is stored per-device on Helia instead of only IndexedDB). Exact contract or IPFS schema is left to implementation; the product rule is **max 2 devices** for fast login/recovery.

### 1.3 On the blockchain

| Data | Contract | Purpose |
|------|----------|--------|
| Identifier hash → lockACid, lockCCid, recoveryKeyHash, emergencyCid, wallet, role, licenseHash, exists | **IdentityRegistry** | Identity and recovery; Lock A/C content on **Helia**, only CIDs on-chain. |
| Guardians (patient → list of guardian addresses) | IdentityRegistry | Social recovery. |
| patients set, records (metadata), patientRecords, accessManifestCid, emergencyRecords, unconscious*, accessRequested, events | **HealthRegistry** | Record ownership, access control, emergency tiers; file content and DEKs on **Helia**. |

### 1.4 On Helia (IPFS) — client-side only, no server pinning

Helia runs **in the browser**; the app pins and fetches from IPFS directly from the client. No server that pins.

- Lock A / Lock C **content** (encrypted wallet backup).
- Encrypted **files** (medical records).
- Encrypted **DEKs** (access manifest per patient).
- Optional: encrypted **profile** or **journey** payloads; CIDs referenced on-chain or in share links so the system stays decentralised and no central DB is used.

---

## 2. Journey: decentralised, least-access, shareable with anyone and family

### 2.1 Principle: no central server, each party sees only what they need

The journey happens **between patient, doctor, and hospital** in a **decentralised** way. No central server should hold journey data in the clear or act as a trusted middleman.

- **Security:** The system must **not be hackable** in a way that exposes one role’s data to another. **Each party sees only what they need:**
  - **Patient:** Full journey (hospital, departments, token number, checkpoints, status); can share with anyone via link; can control what family sees (see below).
  - **Doctor:** Only what is needed for their role — e.g. **patients in their department** (token number, current checkpoint, status for that department); not the patient’s full history or other departments.
  - **Hospital:** Only what is needed for queue and care — e.g. **journeys at this hospital**, per-department queue (token numbers, order), queue visibility only — only the allotted doctor marks checkpoint done (e.g. “check up done”); not the patient’s medical records unless already granted via HealthRegistry.
- **Where journey data lives (decentralised):** Journey data should **not** be stored in a central server DB. Options that fit the stack:
  - **Helia (IPFS):** Patient (or app on their behalf) creates an encrypted **journey payload** (hospital, departments, token number, checkpoints). Stored on Helia; **CID** (or a short journey id that resolves to CID) is used in the **share link**. Who can decrypt what is enforced by **keys** (e.g. patient holds the master key; family/hospital get limited keys or time-limited tokens for the parts they are allowed to see).
  - **Blockchain:** Only **minimal pointers or commitments** if needed (e.g. journeyId ↔ CID, or patient’s consent for “hospital X can see queue for journey Y”). No bulk journey content on-chain.
- So: **journey data goes to Helia (encrypted)** and optionally minimal pointers on-chain; **no central server database**. Patient, doctor, and hospital access via **client + Helia + blockchain**, with **least-access** decryption so each sees only what they need.

### 2.2 Family vs guardian: who can see what, and who can do recovery

- **Family** = people the patient has **linked for sharing** (journey, and optionally medical records). Patient controls what family sees (see below). **Family can also be guardians** (patient may give them recovery access).
- **Guardian** = people who can approve **social recovery only** (e.g. 2 guardians approve → new Lock A). **Guardian does not automatically get family sharing** — so someone can be a guardian (recovery only) and not see journey or records. In practice: **only family are given recovery (guardian) access**; the patient does not give recovery access to anyone other than family. So guardians are always family; but the **role** of guardian is recovery-only and does not by itself grant family (sharing) rights — those are controlled separately.
- **Medical data to friends:** Patient can share **medical records** with friends (or anyone they grant access to) via the same per-document sharing as for doctors. **Recovery (guardian) access is never given to non-family** — only family can be guardians.
- Summary: **Family** = sharing list (journey/records, patient-controlled). **Guardian** = recovery list (on-chain); only family are made guardians. Being a guardian does not grant family sharing; patient explicitly controls what family sees.

### 2.3 Patient can share journey with anyone and with family; patient controls family sharing

- **Share with anyone:** Patient can share their **journey** (e.g. live queue position, current department, token number) with **anyone** via a **shareable link** (e.g. link that contains journeyId or CID + optional access token). Recipients do not need an account; they see only what the patient allowed for that link (e.g. view-only journey status).
- **Share with family:** Patient can share journey (and optionally more) with **linked family members**. Family are other patients (or linked contacts) the patient has added.
- **Patient controls what family sees (fine-grained):**
  - **By default:** Patient can choose whether to **share journey with family by default** (e.g. toggle: “Share my journey with linked family” — on or off).
  - **Medical records:** Patient can choose whether **family can see (some or all) medical records** — separate from journey. So: share journey only, or journey + selected records, or no sharing.
  - **Leave family:** Patient can **remove** a family member (revoke link) at any time. After that, that person no longer sees the patient’s shared journey or records.
- All of this must work in a **decentralised** way: e.g. family access stored as **grants** (patient encrypts a limited-access key for each family member and stores on Helia, or uses on-chain guardian list + per-journey consent); no central server holding “family permissions”.

### 2.4 Where does my journey data go when I start a journey? (concrete)

- Patient starts journey: chooses hospital, departments, visit type; app creates **journey payload** (id, token number e.g. **112**, checkpoints).
- **Decentralised flow:**
  - Journey payload is **encrypted** (key derived from patient wallet or session).
  - Encrypted payload is **pinned to Helia** (your IPFS); **CID** (or journeyId that maps to CID) is produced.
  - **Share link** for “anyone” or “family” contains this reference (e.g. `/journey/track/<journeyId>` or CID + token). Viewer fetches from Helia and decrypts only what that link or their role allows.
  - **Doctor/hospital** see only their slice: e.g. app fetches from Helia only the **queue view** or **department view** for that hospital/department (encrypted under keys that hospital/doctor can derive or that patient has granted on-chain/off-chain). So journey data lives on **Helia**; **no central server DB**.

### 2.5 Queue: token number (e.g. 112), not estimated time

- Queue should be **token / queue number** (e.g. **112** at AIIMS Delhi Eye), not “estimated time”.
- Store per department an **ordered list of token numbers** (or journey checkpoint IDs). Patient’s **number** in that department = position (e.g. 112). Prefer showing **#112**; “est. time” can be secondary if desired.

### 2.6 Patient dequeue and "check up done" — only the allotted doctor

- **Patient dequeue:** Patient can **leave the queue** (dequeue). The updated journey state (e.g. checkpoint "skipped"/"cancelled", removed from department queue) is **re-published to Helia** by the patient’s client No central server.
- **"Check up done":** Only the **doctor who is department-wise allotted to that patient** can mark the checkpoint as **completed**. Neither the patient, nor the hospital, nor any other doctor can mark it done — only that specific doctor (the one allotted to the patient for that department). The update is re-published to Helia (signed or authorised by that doctor); no central server.

### 2.7 Matching patient ↔ doctor ↔ hospital (department logic)

- **Current state:** There is **no department–doctor linking**. Doctors cannot "see only patients in their department" today.
- **To implement (decentralised):** Add a **department–doctor** relation. Doctor’s profile (stored on device or encrypted on Helia, with pointer on-chain if needed) should include **hospital + department**. When listing "my patients in queue", the app fetches journey data from **Helia** and **filters** by department = doctor’s department. Hospital list/departments can be **public or permissioned data on Helia** (or a small on-chain registry), not a central server DB.

### 2.8 Doctor list per hospital + department; patient chooses old doctor or new at journey time

- **Doctors listed under hospital:** Each doctor is linked to **hospital(s)** and **department(s)**. When a patient selects a **hospital** and then a **department** (e.g. Eye at AIIMS Delhi), the app shows **all doctors** of that department at that hospital — with each doctor's current queue so the patient can choose.
- **Preview for each doctor:** For each doctor in that list, show:
  - Doctor name (e.g. Dr. Raghav)
  - **Current queue** for that doctor (e.g. "7 ahead" or token range)
  - A **short description** when applicable:
    - **"Old doctor"** — this doctor has treated this patient before (from past journeys/records on Helia or device).
    - **"Frequent doctor"** — this doctor is one the patient has seen often (same source).
  - If neither applies, show the doctor with no label or "Available today".
- **Patient decides at that moment:** When doing the journey, the patient **chooses at that moment** whether they want their **old doctor** or a **new** one. The UI shows all required doctors of that hospital for that department; the patient picks one. That **chosen doctor** is **allotted** for that department — only that doctor can later mark "check up done".
- **Data for "old" / "frequent":** Derived from the patient's history (past journeys or record uploads where that doctor appears), stored on device or in encrypted payloads on Helia; no central server.

### 2.9 OPD schedule (e.g. Eye dept closed on Monday)

- **Current state:** There is **no OPD schedule**; patient can select a department even when it is closed.
- **To implement (decentralised):** Hospital/department **schedule** (e.g. `openDays`, time slots) can be stored as **config on Helia** (published by hospital) or minimal on-chain. When patient selects hospital and department, the app **filters or warns** using that config (e.g. hide or mark "Closed on Mondays"). No central server DB. When the department is open, the app then shows **all doctors** of that department (see §2.8) so the patient can choose.

### 2.9a Department display: Avg Service and Est Wait

- **Avg Service (e.g. "5 min"):** Comes from each department’s **`avgServiceTime`** (minutes per patient). The UI shows this as “Avg Service: X min”.
- **Est Wait (e.g. "15 min"):** Derived from queue and service time (e.g. `currentQueue × avgServiceTime`, or similar). Shown as “Est Wait: Y min”. Both are **hospital/department** data only; no patient-specific hardcoding.

### 2.9b Portal vs Home

- **Home** = main dashboard for the role (e.g. `/patient/home`, `/hospital-portal/home`, `/doctor-portal/home`), opened from the **nav “Home”** link.
- **Portal** = full profile / “My Portal” (or “Hospital Portal” / “Doctor Portal”) opened from the **profile dropdown** (e.g. “Patient Portal”, “Hospital Portal”, “Doctor Portal”). It’s the detailed view for that role; **Home** and **Portal** are different screens.

---

### 2.10 Session vs journey: full checkup / treatment spanning multiple visits and days

What we call a **journey** today is one **visit** (one trip to the hospital with a token and checkpoints). In practice, Indian patients often have a **full checkup or treatment** that stretches over **multiple visits and days** — e.g. thyroid checkup: Day 1 → OPD (doctor orders blood, urine, MRI); next day or later → Lab (blood, urine); another day → Radiology (MRI); then back to OPD (same or available doctor) with reports.

- **Session (episode of care):** A logical unit that can span **multiple visits and multiple days** — e.g. "Thyroid checkup Jan 2025", "Knee treatment 2025".  
  - **Session** has: sessionId, patientWallet, hospitalId, reason/title (e.g. "Thyroid checkup"), **visits[]**, startedAt, status (active / completed).  
  - Stored on **Helia** (encrypted), same as journey; no central server.

- **Visit:** One **trip** to the hospital (or one logical step in the session).  
  - **Visit** has: visitId, sessionId, hospitalId, **when they went** (date/time), **which department(s)** (e.g. OPD, then Lab next day), **which doctor** (allotted), **what the doctor said** (consultation notes), **tests ordered** (if any), token number, checkpoints, status.  
  - So one **session** = many **visits**; one **visit** = what we currently model as one **journey** (one token, one set of checkpoints per visit).

- **Why this matters:** The patient (and family) want to see: **When did I go to the hospital? Which department? What did the doctor say? When will my test result be available? What is the queue for that test?** And when the test is done: **How will the hospital upload the report to me?** All of this is covered below.

---

### 2.11 Tests ordered, test queue, and when report is available

- **Doctor orders tests (e.g. blood, urine, MRI):** During a **visit** (OPD), the allotted doctor can add **orders**: test type (blood, urine, MRI, etc.), **department/lab** where the test happens (may be same hospital, same day or next day / other day), and **expected date/time** when the result will be available at the hospital.
- **Patient goes for tests on another day:** Patient comes back (or goes to lab/radiology on the same day). They need to see:  
  - **Which department** (e.g. Lab, Radiology)  
  - **When will the written/test result be available** at the hospital (e.g. "Report ready by 5 PM tomorrow")  
  - **What is the queue for that test** (e.g. MRI token #3, or "5 ahead in lab queue")  
- So each **order** has: testType, departmentId (lab/radiology), **expectedReadyAt** (when result will be available), **queue/token** for that test (so patient can see their position in lab/radiology queue), **status** (pending / done). When the test is **done**, the hospital uploads the report (see below).

- **Data:** Orders live in the **session/visit payload** on Helia (encrypted); queue for lab/radiology is part of the same decentralised queue model (per-department token list on Helia). **expectedReadyAt** is set by doctor or lab when the order is placed.

---

### 2.12 How the hospital uploads the report to the user (patient)

- **When the test is done,** the **hospital** (or lab staff) **uploads the report** so the **patient** gets it in their records.
- **Flow (decentralised):**  
  - Hospital staff (or doctor) use the app as **hospital** (or verified clinician): search patient by email/phone → get patient wallet.  
  - They **upload the file** (e.g. PDF of MRI report): app encrypts with patient’s record key (or DEK for this record), pins to **Helia**, and registers the **record** in **HealthRegistry** (metadata: patient, uploader, fileCid, fileType e.g. `lab_result` / `imaging`). This is the same **record upload** flow we already have (doctor/hospital can add record for a patient once they are authorised or the patient has granted access).  
  - **Patient** sees the new record in **their records** (patient app fetches from HealthRegistry + Helia). Optionally the app can show a **notification** (e.g. "Your MRI report is ready") — e.g. when patient next opens the app or via a push if we add it; no central server required for the upload itself.

- **Summary:** Hospital uploads report → file encrypted and pinned to **Helia** → record metadata (patient, uploader, fileCid, fileType) in **HealthRegistry** → patient sees in **their records**. No central server; same as existing record flow.

---

### 2.13 Patient timeline / history: what Indian patients want to see

The patient (and family, if they have access) should be able to see a **timeline** of their care:

| What they want to see | Where it comes from |
|-----------------------|----------------------|
| **When I went to the hospital** | Visit date/time in **session/visit** payload on Helia. |
| **Which department I went to** | Department name/type per visit (and per checkpoint) in session/visit. |
| **What the doctor said** | **Consultation notes** — stored as part of the visit (e.g. in visit payload on Helia) or as a **record** (e.g. fileType `consultation_note` or note text in visit). Patient sees in timeline and/or in records. |
| **When will my test result be available at the hospital?** | **expectedReadyAt** per **order** (test) in the session/visit payload. |
| **What is the queue for that test?** | Queue/token for that **department** (lab/radiology) — same token list on Helia; patient’s position in queue for that test. |
| **Is my test done? Report uploaded?** | Order **status** (pending → done) in session/visit; when done, **report** appears in patient’s **records** (hospital uploaded via HealthRegistry + Helia). |

- **Implementation:** Session and visit payloads (on Helia) include: visits[], each visit with date/time, department(s), doctor, **consultationNotes**, **orders[]** (testType, departmentId, expectedReadyAt, queue/token, status, and when done — recordId or fileCid so the app can link to the uploaded report in records). Patient app **aggregates** session + visits + records and shows a **timeline** (when I went, which department, what doctor said, tests ordered, when result available, queue for test, and when report was uploaded).

---

### 2.14 After "check up done" — what next?

When the **allotted doctor** marks the checkpoint as **"check up completed"**, the following should happen so the flow continues seamlessly:

1. **Consultation notes (what the doctor said)**  
   Before or when marking "check up done", the doctor can add **consultation notes** (short text: what they said, advice, follow-up). This is stored in the **visit** payload (or as a record) so the patient sees it in the **timeline** ("what the doctor said").

2. **Tests ordered (if any)**  
   If the doctor ordered tests (blood, urine, MRI, etc.), the doctor adds **orders** to this visit: test type, department/lab, **expected date/time** when the result will be available. The **session** continues: the patient will have a **next visit** (e.g. Lab, then Radiology, then back to OPD with reports). So after "check up done" for this **visit**, the session is still **active** — next step is "go for tests" or "come back with reports".

3. **Current visit marked complete**  
   The checkpoint for this department (e.g. OPD consultation) is **completed**. The visit status can be updated to "consultation done". The patient (and family) see in the timeline: "Went to OPD on &lt;date&gt;, Dr. X, check up completed. Doctor said: &lt;notes&gt;. Tests ordered: blood, urine, MRI — see next steps."

4. **Next steps for the patient**  
   - If **no tests ordered:** This visit is done. Patient can **end the session** or **add another visit** (e.g. follow-up later).  
   - If **tests ordered:** Patient sees **orders** with: which department (Lab, Radiology), **when result will be available**, **queue for that test**. Patient goes on the next day (or when ready) → starts or continues the **same session** with a **new visit** (e.g. Lab visit, token for lab). When tests are done, hospital uploads reports → patient sees in records; then patient can **come back to OPD** (same or available doctor) with reports → that becomes another **visit** in the same session.

5. **Session completed**  
   When all visits are done (consultation done, tests done, reports uploaded, follow-up consultation done if any), the **session** can be marked **completed**. Patient timeline then shows the full history for that episode of care.

So: **"Check up done"** → save consultation notes + orders (if any) → update visit/checkpoint → patient sees next steps (go for tests / when result available / queue for test) → session continues until all steps are done → then session completed.

---

### 2.15 Unconscious patient: doctor/surgeon access with proof, and first responder notified

When the **patient is unconscious**, the system allows verified hospital staff (doctor, surgeon, nurse, etc.) to get **time-limited access** to the patient’s medical docs and timeline so they can operate, **with proof** (two co-signatures), and the **first responder (emergency contact) is notified**.

- **Proof:** Two verified staff (e.g. doctor + nurse, or surgeon + resident) **co-sign** the Unconscious Protocol on-chain (HealthRegistry). That is the **proof** that the patient is in emergency care and access is needed. After a **30-minute veto window** (during which the patient or a guardian can veto), access opens for **72 hours** so the care team can view medical records and timeline.
- **Access:** Once the protocol is executed, the hospital that co-signed gets time-limited access to the patient’s **emergency-tier records** (and, per implementation, to the data needed for care — medical docs, timeline). Doctors/surgeons can use this to **operate** and coordinate care. Access is on-chain (unconsciousAccess) and DEKs/records are fetched from Helia per existing record flow.
- **First responder notified:** As soon as the **second** staff co-signs, the system **notifies the first responder(s)** — e.g. via SMS (Fast2SMS) or similar — with a message like: *“Your contact [Name] was admitted in an emergency. Hospital: [X]. Time: [Y]. Unconscious Protocol has been initiated; you can veto within 30 minutes if needed.”* So the **first responder is always notified** when Unconscious Protocol is triggered.
- **First responder and emergency contact can be family:** The **emergency contact** (primary) is the main **first responder** — the person to call/notify in emergency. They **can be family** (e.g. spouse, parent). The patient can also add **additional first responders** (e.g. second family member) so more than one person gets notified. All can be family; each has a **relation** attribute (see below).

---

### 2.16 Relation attribute: emergency contact and first responder

- **Emergency contact** and **first responder(s)** can be **family** (spouse, parent, sibling, etc.) or other (friend, guardian). Each has a **relation** attribute for consistency and display.
- **Relation** (allowed values): Spouse, Parent, Child, Sibling, Guardian, Friend, Other family, Other. Use this in the patient profile for emergency contact and for any additional first responders. Stored in profile (device/Helia) and optionally in emergency profile (emergencyCid) so it can be shown on the emergency page (e.g. “Emergency contact: Jane Doe (Spouse)”).
- **First responder list:** By default, the **emergency contact** is the first responder (the one notified when Unconscious Protocol or break-glass is used). The patient can optionally add **more first responders** (name, phone, relation) — e.g. spouse + parent — so all get notified. All can be family; relation is stored for each.

---

### 2.17 Hospital staff titles (Doctor, Surgeon, Nurse, etc.)

- **Hospital roles** are not only “doctor” or “hospital” but can have a **title** for display and for Unconscious Protocol co-sign: e.g. **Doctor**, **Surgeon**, **Nurse**, **Consultant**, **Resident**, **Other**.
- **IdentityRegistry** stores an optional **title** (string) per identity. When a clinician (doctor/hospital role) registers or updates their profile, they can set their title (e.g. “Surgeon”, “Nurse”). So when **two staff co-sign** Unconscious Protocol, the app can show “Dr. X (Surgeon) and Y (Nurse) co-signed” — making the **proof** clear.
- **Use in app:** Patient sees clinician title where relevant (e.g. “Consulting Surgeon”); co-sign UI shows titles; emergency/Tier-2 flows can display who signed. Titles are stored on-chain (IdentityRegistry.title) or in profile on Helia; contract supports optional title via `setTitle(idHash, title)`.

---

## 3. Hospital features (current vs needed) — decentralised

| Feature | Current | Notes (decentralised target) |
|--------|---------|------------------------------|
| Queue / journey list | UI calls **GET /api/hospitals/[id]/journeys** (route missing) | Journey list should come from **Helia** (fetch journeys for this hospital from IPFS), not a central DB. |
| Department queue status | From `hospital.departments` (hardcoded) | Queue (token numbers) can live in **journey payloads on Helia**; hospital/department list from Helia or on-chain. |
| Update checkpoint ("check up done") | UI calls **POST /api/journey/[id]/checkpoint** (route missing) | Update = **re-publish updated journey to Helia** (signed by the allotted doctor only); no central server. |
| Search patient (email/phone) | **GET /api/doctor/search** (blockchain) | Works; stays decentralised (on-chain identity). |
| Bulk upload records | **/hospital/upload** page | Records go to **HealthRegistry + Helia** (encrypted); no central DB. |
| View emergency page | Link to `/emergency/[wallet]` | Works (public Tier-0 from Helia/on-chain). |
| **OPD schedule** | Not implemented | Hospital publishes schedule to **Helia** (or minimal on-chain); app filters/warns. |
| **Doctor–department link** | Not implemented | Doctor profile (on device/Helia) includes hospital + department; filter journey view by department. |

Hospital UI exists; implementation should use **blockchain + Helia + device only**, with **least-access** so hospital sees only what it needs.

---

## 4. Attributes: patient, doctor, hospital — current vs required for flow

### 4.1 Patient — current attributes

**Where they appear:** `PatientData` (patient/page.tsx, patient-portal/page.tsx), `api/patient/status`, `PatientEmergencyData` (emergency/[address]), `lib/types.ts` (Patient, PatientRegistrationData).

| Attribute | Source | Notes |
|-----------|--------|--------|
| name / fullName | UI, status API | ✅ |
| dateOfBirth | UI, status API | ✅ |
| gender | UI, status API | ✅ |
| bloodGroup | UI, status API | ✅ |
| phone | UI, status API | ✅ |
| email | Session / status | ✅ |
| address, city, state, pincode | UI, status API | ✅ |
| emergencyName, emergencyRelation, emergencyPhone | UI, status API | ✅ |
| allergies, chronicConditions, currentMedications, previousSurgeries | UI, status API | ✅ |
| height, weight | UI, status API | ✅ |
| profilePicture | UI, status API | ✅ |
| walletAddress | Session / status | ✅ (identifier) |
| waistCircumference, privacySettings | Emergency page only | Optional / emergency |

**Needed for flow (add):**

| Attribute | Purpose |
|-----------|--------|
| **lastDoctorsSeen** (or equivalent) | List of { doctorWallet, hospitalId, departmentId, lastSeenAt } so the app can show "Old doctor" / "Frequent doctor" when listing doctors for a department. Can live on device or in encrypted payload on Helia. |
| (Optional) **linkedFamily** | List of linked family (wallet or id) for sharing; may overlap with on-chain guardians. |
| (Optional) **familySharingPrefs** | e.g. shareJourneyByDefault, shareRecordsWithFamily — can be part of profile. |

---

### 4.2 Doctor — current attributes

**Where they appear:** `DoctorData` (doctor/page.tsx, doctor-portal/page.tsx), `lib/types.ts` (Doctor: address, name?, specialty?).

| Attribute | Source | Notes |
|-----------|--------|--------|
| name | DoctorData, form | ✅ |
| email | Session / DoctorData | ✅ |
| phone | DoctorData | ✅ |
| licenseNumber | DoctorData | ✅ |
| specialization | DoctorData | ✅ |
| qualification | DoctorData | ✅ |
| experience | DoctorData | ✅ |
| hospital | DoctorData | ✅ **Free text** — not linked to hospital id |
| city, state | DoctorData | ✅ |
| walletAddress | Session (doctor) | ✅ (identifier) |
| isAuthorized | DoctorData | ✅ |
| profilePicture | DoctorData | ✅ |

**Needed for flow (add):**

| Attribute | Purpose |
|-----------|--------|
| **hospitalId** | Link doctor to a hospital from the hospital list (e.g. from Helia or on-chain). Replaces or supplements free-text `hospital` so "Dr. Raghav at AIIMS Delhi" maps to hospital `id: "h1"`. |
| **departmentIds** (or **departmentId**) | One or more departments at that hospital (e.g. `["d_eye", "d_opd"]`). So when patient selects hospital + department, the app can list **doctors in that department**. |
| (Optional) **availability** | e.g. "Available today", "On leave" — for preview when patient chooses doctor. |
| (Optional) **queueCount** / **currentQueue** | Per-doctor queue length; can be computed from journey payloads on Helia when listing doctors for a department. |

---

### 4.3 Hospital and department — current attributes

**Where they appear:** `api/hospitals` (hardcoded), `Hospital` / `Department` in patient/journey/start, hospital/admin, JourneyTracker.

**Hospital (current):**

| Attribute | Source | Notes |
|-----------|--------|--------|
| id | hospitals API | ✅ |
| name | hospitals API | ✅ |
| code | hospitals API | ✅ |
| city | hospitals API | ✅ |
| state | hospitals API | ✅ (in journey start) |
| type | hospitals API | ✅ (e.g. "Multi-specialty") |
| address | JourneyTracker only | Optional |
| departments | hospitals API | ✅ Array of Department |

**Department (current):**

| Attribute | Source | Notes |
|-----------|--------|--------|
| id | hospitals API | ✅ |
| name | hospitals API | ✅ |
| code | hospital/admin, JourneyTracker | ✅ |
| type | hospitals API | ✅ (registration, consultation, pharmacy, etc.) |
| floor | hospitals API | ✅ |
| wing | Optional in some UIs | ✅ |
| avgServiceTime | hospitals API | ✅ |
| currentQueue | hospitals API | ✅ |
| maxCapacity | hospitals API | ✅ |

**Needed for flow (add):**

| Level | Attribute | Purpose |
|-------|------------|--------|
| **Hospital** | **doctors** (or **doctorIds**) | List of doctors linked to this hospital (and optionally per department), so "all doctors of this department" can be shown when patient selects hospital + department. Can be stored in hospital config on Helia. |
| **Department** | **doctorIds** (or **doctors**) | List of doctor ids/wallets for this department at this hospital. Enables "show all doctors of this department" with name, queue, and "Old doctor" / "Frequent doctor" label. |
| **Department** | **openDays** / **schedule** | OPD schedule (e.g. closed on Monday). So patient sees only open departments or a "Closed on Mondays" note. |
| **Department** | (optional) **timeSlots** | Opening/closing time if needed. |

---

### 4.4 Field alignment summary

| Concept | Patient (profile) | Doctor (profile) | Hospital / department |
|--------|--------------------|------------------|------------------------|
| Name | fullName / name | name | hospital name |
| Contact | phone, email | phone, email | — |
| Location | address, city, state, pincode | city, state | city (hospital) |
| Identifier | wallet (from auth) | wallet | — |
| "Where do I work" | — | **hospitalId** (add) + hospital (text) | hospital id, name, code |
| "Which department" | chosen in journey (departmentIds) | **departmentIds** (add) | department id, name, type, floor + **doctorIds** (add) |
| Queue / token | tokenNumber (journey) | **currentQueue** per doctor (add or computed) | department.currentQueue, token list |
| "Old / frequent doctor" | **lastDoctorsSeen** (add) | — | — |
| OPD schedule | — | — | **openDays** / **schedule** (add) on department |

### 4.5 Where to add the new attributes (decentralised)

- **Patient (lastDoctorsSeen, familySharingPrefs):** Store on **device** (e.g. RxDB) or in an **encrypted profile payload on Helia** (CID on-chain or in session). No central DB.
- **Doctor (hospitalId, departmentIds):** In **doctor profile** — today profile is in app state / would come from API; in a decentralised setup, store in **device** and/or **encrypted on Helia** (doctor publishes their profile; hospital list references or includes doctor ids). Ensure doctor registration/onboarding collects **hospitalId** (from hospital list) and **departmentIds** (from that hospital's departments).
- **Hospital (doctors / doctorIds):** In **hospital config** published on **Helia** (or minimal on-chain). When a doctor links to hospitalId + departmentIds, that link can live in the doctor profile; the hospital config can be a separate payload that lists doctors per department, or the app can aggregate from doctor profiles.
- **Department (doctorIds, openDays, schedule):** **doctorIds** can be part of the hospital config on Helia (each department has a list of doctor ids). **openDays** / **schedule** in the same hospital/department config on Helia so the app can filter "closed today" when patient selects.
- **lib/types.ts:** Add **hospitalId**, **departmentIds** to a shared `Doctor` or doctor-profile type; add **lastDoctorsSeen** (or a type for it) for patient; add **openDays** / **schedule** to the Department type used by journey and hospitals.

### 4.6 Session, visit, and order attributes (multi-visit / full checkup / tests / report upload)

**Current:** The app has **journey** (one visit: hospital, departments, token, checkpoints). No **session** (multi-visit) or **orders** (tests) or **consultation notes** or **expectedReadyAt** / report-upload link.

**Needed for flow (add):**

| Concept | Attributes | Purpose |
|---------|------------|--------|
| **Session** | sessionId, patientWallet, hospitalId, reason/title (e.g. "Thyroid checkup"), visits[], startedAt, status (active / completed) | One episode of care spanning multiple visits and days. Stored on Helia (encrypted). |
| **Visit** | visitId, sessionId, hospitalId, **visitedAt** (date/time), **departmentIds[]**, **allottedDoctorWallet**, **consultationNotes** (what the doctor said), **orders[]** (tests ordered), tokenNumber, checkpoints[], status | One trip to hospital; when they went, which department, which doctor, what doctor said, tests ordered. Stored inside session payload on Helia. |
| **Order** (test) | orderId, testType (e.g. blood, urine, MRI), **departmentId** (lab/radiology), **expectedReadyAt** (when result will be available at hospital), **queueToken** / queue position for that test, **status** (pending / done), **recordId** (when done — link to uploaded report in HealthRegistry) | So patient sees: when will my test result be available, what is the queue for that test, and when report is uploaded. Stored inside visit payload on Helia. |
| **Consultation notes** | Text or short note per visit (what the doctor said) | Part of visit payload, or a separate record (e.g. fileType `consultation_note`) so patient sees "what the doctor said" in timeline. |

**Report upload by hospital:** When test is done, hospital (or lab) **uploads the report file** for that patient → encrypted to **Helia**, record metadata (patient, uploader, fileCid, fileType e.g. `lab_result` / `imaging`) in **HealthRegistry** → patient sees in **their records**. Optionally set **order.recordId** and **order.status = done** in the session/visit payload so the timeline shows "Report uploaded" and links to the record.

**Patient timeline:** App aggregates **sessions** (with visits and orders) + **records** and shows: When I went → Which department → What the doctor said → Tests ordered → When result will be available → Queue for that test → Report uploaded (link to record).

---

## 5. Frontend coverage per role

| Role | Nav / entry | Post-login redirect | Main pages |
|------|-------------|---------------------|------------|
| **Patient** | Yes (home, family, emergency, records, permissions) | `/patient/patient-portal/home` | patient/*, patient/patient-portal/*, journey |
| **Doctor** | Yes (doctor-portal home, patients, upload, voice) | `/doctor-portal/home` | doctor/*, doctor-portal/* |
| **Hospital** | **No** (no nav link, no role in dropdown) | **No** (unknown role stays on landing) | Pages exist: `/hospital/admin`, `/hospital/upload`, `/hospital/journey/[id]` but **no way to get there from app nav** unless user types URL or you add hospital login + nav. |
| **Family** | No separate UI | — | Patient uses "family" to link; family member uses own patient account. |

So: **frontend is fully catered for Patient and Doctor**; **Hospital** has pages but is **not catered** in nav or redirect; **family** is just "patient linking patients".

---

## 6. Full cycle: patient ↔ doctor ↔ hospital (data flow) — decentralised only

- **Patient**  
  - **Stored:** Identity (device + on-chain); Lock A/C on **Helia**. Profile and journey on **device** (RxDB/localStorage) and/or encrypted on **Helia** (CID on-chain if needed). Records: metadata on-chain, files and DEKs on **Helia**.  
  - **Flow:** Registers → starts journey (hospital, departments) → gets token number (e.g. **112**) → **shares journey** with anyone (link) or with **family** (with fine-grained control: journey on/off by default, medical records on/off, can remove family). Grants record access to doctor (on-chain + DEK on Helia). Can dequeue (journey state updated and re-pinned to Helia).  
  - **Sees:** Full journey; own records; who has access. **Does not see** other patients’ data or doctor/hospital internal data beyond what is needed for their care.

- **Doctor**  
  - **Stored:** Identity (device + on-chain); Lock A/C on Helia. Profile on device or encrypted on Helia.  
  - **Flow:** Searches patient (email/phone → wallet via chain) → requests access (on-chain) or is granted by patient → views/uploads records (DEKs from Helia, files from Helia). Sees **only patients in their department** (journey data from Helia, filtered by department); marks "check up done" (update re-pinned to Helia, signed by that doctor only).  
  - **Sees:** Only what they need — e.g. queue for their department, token numbers, checkpoint status for their department; records only for patients who granted access. **Does not see** full journey of other departments, or other hospitals’ queues, or data not granted.

- **Hospital**  
  - **Stored:** Hospital/department list and OPD schedule can be **published on Helia** (or minimal on-chain). No central server DB.  
  - **Flow:** Staff use app (with or without hospital role in IdentityRegistry). See **only journeys at this hospital**, per-department queue (token numbers). Hospital does not mark "check up done" — only the allotted doctor can. Upload records for patient (HealthRegistry + Helia).  
  - **Sees:** Only what they need — queue for their hospital/departments, token numbers. **Does not see** patient’s full medical history unless already granted via HealthRegistry; **does not see** other hospitals’ data.

- **Family (linked by patient)**  
  - **Sees:** Only what the **patient** allows: e.g. journey (if patient turned on “share journey with family”), and/or selected medical records (if patient enabled that). Patient can **remove** family at any time (revoke); then family sees nothing.  
  - All enforced in a **decentralised** way (grants/keys on Helia or on-chain, no central server).

- **Data transfer (no third-party services):**  
  - **Identity / keys:** Never leave device in plain form; Lock A/C on **Helia** (encrypted), CIDs on-chain. **Max 2 devices** for Lock B.  
  - **Records:** Encrypted on **Helia**; DEKs shared via grant (encrypted per grantee); metadata on-chain.  
  - **Journey / queue:** Encrypted journey payloads on **Helia**; share links and role-based decryption so **each party sees only what they need**. No central server DB.  
  - **Profile:** On **device** and/or encrypted on **Helia** (e.g. emergencyCid on-chain). No central server.

**Summary — only three places:**

- **Device:** Keys, Lock B (max 2 devices), local identity, profile/journey cache.
- **Blockchain:** Identity, record metadata, access CIDs, minimal pointers; **no bulk content**.
- **Helia (IPFS) in the browser:** Encrypted Lock A/C, files, DEKs, journey payloads, optional profile/config; **client-side only**, no server pinning, no third-party IPFS.

**ICE notifications:** Fast2SMS (or similar) for emergency alerts (e.g. "your contact was admitted") is acceptable per product.

---

## 7. Role attributes and frontend coverage — what we need from each, and does the frontend cater?

To make **all flows and features work seamlessly**, we need: (1) **fixed attributes per role** (what info we need from each), (2) **what the frontend must collect or show** for each, and (3) **whether the frontend currently has** the page, form fields, and data path (API/Helia). Below is a concise checklist.

### 7.1 Patient — attributes we need, and frontend checklist

| Attribute / need | Required for flow | Frontend: page/form | Frontend: available? |
|------------------|--------------------|----------------------|------------------------|
| name, dateOfBirth, gender, bloodGroup, phone, email, address, city, state, pincode | Profile, emergency, records | patient portal, patient/register, api/patient/status | ✅ Pages and forms exist |
| emergencyName, emergencyRelation, emergencyPhone | Emergency, ICE | patient portal, emergency page | ✅ |
| allergies, chronicConditions, currentMedications, previousSurgeries, height, weight | Profile, emergency | patient portal | ✅ |
| walletAddress | Identity, records, journey | From auth/session | ✅ |
| **lastDoctorsSeen** (for "Old doctor" / "Frequent doctor") | Doctor list per department | — | ❌ No form or store; need to add (device or Helia) |
| **linkedFamily / familySharingPrefs** | Family sharing controls | patient/family | ⚠️ Family page exists; sharing prefs (journey on/off, records on/off) not fully wired |
| **Session/visit history** (when I went, which dept, what doctor said, orders, report uploaded) | Patient timeline | — | ❌ No timeline page; journey list exists but no session/visit/orders model in UI |

**Patient pages that exist:** `/patient`, `/patient/home`, `/patient/patient-portal/home`, `/patient/records`, `/patient/access`, `/patient/permissions`, `/patient/emergency`, `/patient/family`, `/patient/journey`, `/patient/journey/start`, `/patient/journey/[id]`, `/patient/upload`, `/patient/register`, `/patient/audit`, `/patient/download`.  
**Missing for seamless flow:** (1) **Doctor selection** step in journey start (hospital → department → **list of doctors** → choose doctor → start visit). (2) **Session** (multi-visit) and **visit** with consultation notes + orders in UI. (3) **Timeline** page (when I went, which department, what doctor said, when test ready, queue for test, report uploaded). (4) **lastDoctorsSeen** (or equivalent) so "Old doctor" / "Frequent doctor" can be shown.

---

### 7.2 Doctor — attributes we need, and frontend checklist

| Attribute / need | Required for flow | Frontend: page/form | Frontend: available? |
|------------------|--------------------|----------------------|------------------------|
| name, email, phone, licenseNumber, specialization, qualification, experience | Profile, search | doctor/page (profile form) | ✅ Form exists |
| **hospital** (free text) | Display only | doctor/page | ✅ |
| **hospitalId** (link to hospital list) | Doctor list per hospital+department, queue per doctor | — | ❌ Not in form; need dropdown/select from hospitals list |
| **departmentIds** (link to department list of that hospital) | Doctor list per department, "my patients in queue" | — | ❌ Not in form; need multi-select for departments |
| walletAddress | Identity, upload records | From auth/session | ✅ |
| isAuthorized | Verification badge | doctor/page | ✅ |
| **Consultation notes** (what doctor said) + **Orders** (tests: type, dept, expectedReadyAt) | After "check up done", patient timeline | — | ❌ No UI for doctor to add notes/orders when marking check up done |
| **Mark "check up done"** (only allotted doctor) | Visit completion | hospital/journey/[id] (hospital view) | ⚠️ Page exists but calls non-existent API; doctor-specific view for "my patients" + mark done not wired |

**Doctor pages that exist:** `/doctor`, `/doctor/home`, `/doctor/patients`, `/doctor/upload`, `/doctor/voice`, `/doctor-portal/*`.  
**Missing for seamless flow:** (1) **hospitalId** and **departmentIds** in doctor profile (form + store). (2) **Doctor-side view** of "my patients in queue" (filter by my department) and **mark "check up done"** with optional **consultation notes** and **orders** (tests). (3) **API or Helia path** for doctor profile (currently no /api/doctor/profile).

---

### 7.3 Hospital — attributes we need, and frontend checklist

| Attribute / need | Required for flow | Frontend: page/form | Frontend: available? |
|------------------|--------------------|----------------------|------------------------|
| id, name, code, city, state, type, departments[] | Journey start, queue, OPD | api/hospitals, journey/start, hospital/admin | ✅ From API (hardcoded); departments have id, name, type, floor, currentQueue, maxCapacity |
| **department.doctorIds** (doctors in this department) | Doctor list when patient selects dept | — | ❌ Not in API or UI |
| **department.openDays / schedule** | OPD schedule (e.g. closed Monday) | — | ❌ Not in API or UI |
| **Upload report** for patient (after test done) | Patient gets report in records | hospital/upload | ✅ Page exists; flow (search patient → upload file → HealthRegistry + Helia) needs to be wired end-to-end |
| **Queue / journey list** per hospital | Hospital admin, doctor "my patients" | hospital/admin calls api/hospitals/[id]/journeys | ❌ Route missing; data should come from Helia in decentralised design |
| **Doctor cannot mark "check up done"** (only allotted doctor) | Correct authority | hospital/journey/[id] | ⚠️ Today UI allows hospital to update checkpoint; must restrict to allotted doctor only |

**Hospital pages that exist:** `/hospital/upload`, `/hospital/admin`, `/hospital/journey/[id]`.  
**Missing for seamless flow:** (1) **Nav/entry** for hospital (no link in navbar; user must type URL). (2) **department.doctorIds** and **department.openDays** in hospital/department config (API or Helia). (3) **Journey list** source (Helia, not central API). (4) **Restrict "check up done"** to allotted doctor only (hospital page should not allow marking done; only doctor view should).

---

### 7.4 Flows and features — frontend coverage matrix

| Flow / feature | Patient | Doctor | Hospital | Frontend: page exists? | Frontend: form/data wired? |
|----------------|---------|--------|----------|------------------------|-----------------------------|
| Register / login | ✅ | ✅ | ❌ (no signup) | ✅ auth, patient, doctor | ✅ |
| Profile (edit, save) | ✅ | ✅ | — | ✅ patient portal, doctor page | ✅ patient; doctor profile API missing |
| Start **session** (multi-visit) | Need | — | — | ❌ Only "journey" (single visit) | ❌ No session/visit model |
| Start **visit**: hospital → department → **choose doctor** | Need | — | — | ⚠️ journey/start: no doctor step | ❌ No doctor list, no allottedDoctorId |
| Queue / token (e.g. #112) | Need | Need | Need | ⚠️ Shown in journey tracker; no per-doctor queue | ❌ No persistence (Helia) |
| **Mark "check up done"** (only allotted doctor) | — | Need | Must not | ⚠️ hospital/journey/[id] has button; no doctor-only view | ❌ API missing; must be doctor-signed, Helia |
| **Consultation notes** + **Orders** (tests) when check up done | Need (see in timeline) | Need (add) | — | ❌ No UI | ❌ |
| **When test result available** + **queue for test** | Need | — | — | ❌ No orders in UI | ❌ |
| **Hospital uploads report** → patient sees in records | Need | — | Need | ✅ hospital/upload, patient/records | ⚠️ Upload flow and record link to order need wiring |
| **Patient timeline** (when I went, dept, what doctor said, orders, report) | Need | — | — | ❌ No timeline page | ❌ |
| Doctor list per hospital+department (Old/Frequent doctor) | Need | — | — | ❌ No doctor selection step | ❌ hospitalId, departmentIds, doctorIds per dept |
| Family sharing (journey on/off, records on/off) | Need | — | — | ⚠️ patient/family exists | ⚠️ Prefs and enforcement need wiring |
| OPD schedule (e.g. closed Monday) | Need | — | Need (publish) | ❌ | ❌ openDays/schedule |

---

### 7.5 Summary: what to fix so all flows work seamlessly

1. **Patient:** Add **doctor selection** step (hospital → department → list doctors with queue + "Old/Frequent") and **allottedDoctorId** to visit. Add **lastDoctorsSeen** (or derive from history). Add **timeline** page (sessions + visits + orders + records). Wire **family sharing prefs** (journey on/off, records on/off).
2. **Doctor:** Add **hospitalId** and **departmentIds** to profile (form + store). Add **doctor view** of "my patients in queue" and **mark "check up done"** with **consultation notes** and **orders** (tests). Provide **API or Helia** path for doctor profile.
3. **Hospital:** Add **department.doctorIds** and **department.openDays** to config. Use **Helia** (or agreed source) for journey/session list. **Restrict "check up done"** to allotted doctor only (not hospital). Wire **upload report** → record linked to order so timeline shows "report uploaded".
4. **Session/visit/order model:** Frontend and data (Helia) must support **session** (multi-visit), **visit** (consultation notes, orders), **order** (expectedReadyAt, queue, status, recordId when done). Timeline aggregates session + visits + records.
5. **Nav:** Add **hospital** entry (or auth) if hospital staff should reach hospital pages from the app.
