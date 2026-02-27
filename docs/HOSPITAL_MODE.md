# Hospital mode — screens, registration, and portal data

Companion to **ROLES_AND_FLOWS.md** and **DATA_STORAGE_AND_JOURNEY.md**. Defines what screens the hospital role has, what data we collect at registration, and what the hospital portal shows. Login/signup for hospital is handled separately later.

---

## 1. Hospital screens (routes)

| Screen | Route | Purpose |
|--------|--------|--------|
| **Hospital portal home** | `/hospital-portal/home` | Dashboard: selected hospital, active journeys summary, quick links (Queue, Upload). |
| **Hospital (root)** | `/hospital` | Redirects to `/hospital-portal/home`. |
| **Queue / Admin** | `/hospital/admin` | Select hospital, view active journeys/queue, search patient. Same as existing admin page. |
| **Upload reports** | `/hospital/upload` | Search patient by email/phone, upload files (e.g. lab/imaging reports). Same as existing upload page. |
| **Journey detail** | `/hospital/journey/[id]` | View journey, checkpoints. Only the **allotted doctor** can mark "check up done"; hospital sees queue only. |
| **Hospital registration** | `/hospital/register` | Onboarding: collect hospital name, code, city, state, type, address, departments. |

**Nav bar (hospital role):** Home → `/hospital-portal/home`, Queue → `/hospital/admin`, Upload → `/hospital/upload`.

---

## 2. Data collected at registration (hospital)

Collected on **Hospital registration** (`/hospital/register`). Stored in app state / localStorage / or future API (e.g. `GET/PUT /api/hospital/profile`); no central server in decentralised design — can use Helia later.

| Field | Required | Purpose |
|-------|----------|--------|
| **Hospital name** | Yes | Display name. |
| **Hospital code** | Yes | Short code (e.g. AIIMS-DEL, MAX-PUNE). |
| **City** | Yes | City. |
| **State** | Yes | State. |
| **Type** | No | e.g. Multi-speciality, Clinic, Government. |
| **Address** | No | Full address. |
| **Departments** | Yes (at least one) | List of departments. Each department: **name**, **type** (e.g. OPD, Lab, Radiology), **floor**, **openDays** (e.g. Mon–Fri), optional **schedule** (open/close time). |
| **doctorIds** per department | No (at registration) | Filled when doctors link to this hospital; can be empty at registration. |

---

## 3. Data shown in hospital portal

| Place | Data shown |
|-------|------------|
| **Portal home** | Selected hospital (name, code, city); active journeys count / list (from stub or Helia); quick actions: Go to Queue, Upload report; optional: profile summary (name, code, departments count). |
| **Queue (Admin)** | List of hospitals (if multi); selected hospital’s departments; active journeys per department (token numbers, patient refs); patient search (email/phone → wallet). |
| **Upload** | Patient search; file upload for selected patient (reports → HealthRegistry + Helia). |
| **Journey [id]** | Journey details, checkpoints; no "check up done" button for hospital (only allotted doctor). |

---

## 4. Components reused

- **NavBar** — add hospital branch (Home, Queue, Upload).
- **Profile dropdown** — add "Hospital Portal" when role is hospital.
- **Forms** — same patterns as patient/doctor (inputs, labels, buttons).
- **Hospital admin / upload / journey** — existing pages under `/hospital/*`.

---

## 5. Login / signup (later)

- Hospital **login/signup** and post-login redirect (`role === "hospital"` → `/hospital-portal/home`) to be added when auth supports hospital role.
- Until then: use **dev bypass** to view hospital screens without auth. In `.env.local` set:
  - `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`
  - `NEXT_PUBLIC_DEV_ROLE=hospital`
  Then open **http://localhost:3000/hospital-portal/home** (or run `npm run dev` and go to `/hospital-portal/home`) to see the hospital portal, nav (Home, Queue, Upload), and registration.
