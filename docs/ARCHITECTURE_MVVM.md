# Swasthya Sanchar — Folder Structure, Data Flow & MVVM

This document describes the **target folder structure**, **data flow** by role, and **MVVM** mapping so code stays consistent and easy to extend.

---

## 1. MVVM in this codebase

| Layer | Purpose | Where it lives |
|-------|---------|----------------|
| **Model** | Data shapes, types, and how data is read/written (API clients, storage). No UI. | `src/model/`, `src/features/<feature>/model.ts`, `src/features/<feature>/api.ts`, `src/lib/` (infra) |
| **View** | UI only: pages and components. Minimal logic; they call ViewModels and render. | `src/app/`, `src/components/` |
| **ViewModel** | State and behaviour for the View: hooks and context. Prepare data and actions for the View. | `src/contexts/`, `src/hooks/`, `src/features/<feature>/use*.ts` |

**Data flow (high level):**  
User action in **View** → **ViewModel** (hook/context) → **Model** (API / Helia / device) → response back through ViewModel → View re-renders.

---

## 2. Folder structure (target)

```
src/
├── app/                    # VIEW: Next.js routes & page components (thin)
│   ├── (auth)/             # auth/login, auth/signup, auth/recover, etc.
│   ├── (patient)/          # patient/*, patient/patient-portal/*, patient/journey/*
│   ├── (doctor)/           # doctor/*, doctor-portal/*
│   ├── (hospital)/         # hospital/admin, hospital/upload, hospital/journey/*
│   ├── emergency/          # emergency, emergency/[address]
│   ├── api/                # API routes (server); can call lib/ or feature api helpers
│   └── ...
│
├── components/             # VIEW: Reusable UI (presentation)
│   ├── ui/                 # Buttons, inputs, cards, etc.
│   ├── patient/            # Patient-specific components
│   ├── shared/             # Shared across roles
│   └── ...
│
├── model/                  # MODEL: Shared domain types (single source of truth)
│   └── index.ts            # Re-exports from lib/types.ts
│
├── features/               # Feature-based MVVM (by domain / flow)
│   ├── auth/
│   │   ├── model.ts        # AuthUser, AuthContextType (or re-export)
│   │   └── viewmodel.ts    # useAuthSession, useAuth (re-export from contexts)
│   ├── patient/
│   │   ├── model.ts        # PatientData, PatientProfile (UI shape)
│   │   ├── api.ts          # getPatientStatus, updatePatient, etc.
│   │   └── usePatientProfile.ts
│   ├── doctor/
│   │   ├── model.ts        # DoctorData (UI shape)
│   │   ├── api.ts          # getDoctorProfile, updateDoctor
│   │   └── useDoctorProfile.ts
│   ├── hospital/
│   │   ├── model.ts        # Hospital, Department (re-export from model)
│   │   └── api.ts          # getHospitals, getHospitalJourneys
│   ├── journey/
│   │   ├── model.ts        # Journey, Session, Visit, Order (re-export)
│   │   ├── api.ts          # createJourney, getJourney, checkpoint
│   │   └── useJourneyRealtime.ts  # or re-export from hooks
│   ├── records/
│   │   ├── model.ts        # HealthRecord, RecordType
│   │   └── api.ts          # listRecords, uploadRecord
│   └── index.ts            # Barrel: export * from each feature
│
├── contexts/               # VIEWMODEL: Global (auth, language, accessibility)
│   ├── AuthContext.tsx
│   ├── LanguageContext.tsx
│   └── AccessibilityContext.tsx
│
├── hooks/                   # VIEWMODEL: Shared hooks (voice, journey realtime)
│   ├── useJourneyRealtime.ts
│   ├── useVoiceCommand.ts
│   └── useHospitalQueue (from useJourneyRealtime or here)
│
└── lib/                     # MODEL (infrastructure): crypto, blockchain, IPFS, utils
    ├── types.ts             # All domain types (Patient, Doctor, Hospital, Session, etc.)
    ├── crypto-identity.ts
    ├── device-storage.ts
    ├── blockchain.ts
    ├── ipfs*.ts
    ├── identifier.ts
    ├── indianPostal.ts
    ├── i18n/
    └── ...
```

---

## 3. Data flow by role

- **Patient:** View (patient portal, journey start) → usePatientProfile / useAuthSession → patient api / journey api → Helia / device / API routes.  
  Data: profile (device/Helia), journey/session (Helia), records (HealthRegistry + Helia).

- **Doctor:** View (doctor portal, patients, upload) → useDoctorProfile / useAuthSession → doctor api / records api → Helia / API.  
  Data: profile (device/Helia), patients in department (journey from Helia filtered by departmentIds).

- **Hospital:** View (admin, upload, journey [id]) → hospital api / journey api → Helia / API.  
  Data: hospital config (Helia), journey list for hospital (Helia), upload record (HealthRegistry + Helia).

- **Journey flow:** Patient starts journey (hospital, departments, doctor) → createJourney → Helia. Doctor/hospital see queue; doctor marks check up done (consultation notes, orders) → update journey/session on Helia. Patient sees timeline (sessions + visits + orders + records).

See `docs/DATA_STORAGE_AND_JOURNEY.md` for storage (device vs blockchain vs Helia) and `docs/ROLES_AND_FLOWS.md` for role capabilities.

---

## 4. Import conventions

- **Views (app, components):** Prefer importing from `@/features/<feature>` (e.g. `@/features/auth`, `@/features/patient`) for ViewModels and API. Types from `@/model` or `@/lib/types`.
- **Features:** Import types from `@/lib/types` or `@/model`; infrastructure from `@/lib/*`.
- **API routes (app/api):** Use `@/lib/*` for blockchain, IPFS, identifier; can use feature `api.ts` helpers if they are isomorphic or move fetch logic to a shared module.

---

## 5. Migration path

1. **Phase 1 (done):** Add `model/index.ts`, `features/*` with model + api + viewmodel stubs; document in this file.
2. **Phase 2:** New code uses `@/features/*` and `@/model`; gradually switch existing pages from `@/contexts/AuthContext` to `@/features/auth` (same context underneath).
3. **Phase 3:** Move duplicate types from pages into `features/<feature>/model.ts`; keep `lib/types.ts` as canonical for domain types.
4. **Phase 4:** Thin out page components: move fetch/state logic into feature hooks (usePatientProfile, useDoctorProfile, etc.) so pages only compose View + ViewModel.

---

## 6. Summary

- **Model:** `lib/types.ts` + `model/` + `features/<feature>/model.ts` + `features/<feature>/api.ts` + `lib/` (crypto, IPFS, etc.).
- **View:** `app/` (pages) + `components/`.
- **ViewModel:** `contexts/` + `hooks/` + `features/<feature>/use*.ts` (and re-exports in `features/<feature>/viewmodel.ts`).
- **Data flow:** Aligns with Patient / Doctor / Hospital roles and journey/session/records; see DATA_STORAGE_AND_JOURNEY.md and ROLES_AND_FLOWS.md.
