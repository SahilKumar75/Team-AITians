# Contracts vs Architecture Docs — Alignment Check

This document checks whether **contracts/** (IdentityRegistry.sol, HealthRegistry.sol) are aligned with:

- **docs/ARCHITECTURE_MVVM.md** — folder structure, MVVM, data flow (no contract ABI details).
- **docs/DATA_STORAGE_AND_JOURNEY.md** — device vs blockchain vs Helia, journey on Helia, no journey on-chain.
- **docs/ROLES_AND_FLOWS.md** — roles (patient, doctor, hospital), IdentityRegistry, HealthRegistry, sharing.
- **ARCHITECTURE.md** — Triple-Lock, IdentityRegistry struct/events, HealthRegistry struct/events, DEK off-chain.

---

## 1. Summary

| Doc | Contract alignment | Notes |
|-----|--------------------|--------|
| **ARCHITECTURE_MVVM.md** | N/A | MVVM is frontend structure; contracts are Model (infra). No contract changes required. |
| **DATA_STORAGE_AND_JOURNEY.md** | Aligned | Identity + Health on-chain; journey/session on Helia only. Max 2 devices = app/Helia, not contracts. |
| **ROLES_AND_FLOWS.md** | Aligned | Roles (patient, doctor, hospital) in IdentityRegistry; HealthRegistry for records + access + emergency. |
| **ARCHITECTURE.md** | Aligned (minor naming) | Identity uses `exists` not `verified`; CIDs are `string` not `bytes32`. HealthRegistry is upgraded (DEK in events, accessManifestCid). |

**Critical gap (frontend, not Solidity):** **src/lib/contracts.ts** holds a **legacy HealthRecords ABI** (Patient struct, uint256 recordId, grantDoctorAccess, etc.) that **does not match** **contracts/HealthRegistry.sol**. The **new** contract uses bytes32 recordId, addRecord(patient, fileCid, fileType), grantAccess(recordId, grantee, encDekIpfsCid, newManifestCid), etc. **src/lib/blockchain.ts** uses a minimal ABI that **does** match the new contracts. Frontend should use **blockchain.ts** (and env Identity/Health addresses) everywhere and deprecate **contracts.ts** HEALTH_RECORDS_ABI/HEALTH_RECORDS_ADDRESS.

---

## 2. Role rules and contract coverage (decentralisation architecture)

Does the **contract code** implement all the **rules and capabilities** required for each role by the decentralisation architecture (ARCHITECTURE.md, DATA_STORAGE_AND_JOURNEY.md, ROLES_AND_FLOWS.md)? Below: required rule → where it lives → status.

### 2.1 Patient (on-chain rules)

| Required rule / capability | Where it must live | In contract? | Notes |
|----------------------------|--------------------|--------------|--------|
| Register identity (email/phone → wallet, role=patient, lockACid, lockCCid, emergencyCid) | IdentityRegistry | Yes | `register(identifierHash, lockACid, lockCCid, recoveryKeyHash, emergencyCid, role, licenseHash)` |
| One wallet per identity (no double use) | IdentityRegistry | Yes | `require(walletToIdentifier[msg.sender] == 0)` |
| Update Lock A (e.g. password change) | IdentityRegistry | Yes | `updateLockA(idHash, newLockACid)` |
| Update emergency profile (Tier 0) | IdentityRegistry | Yes | `updateEmergencyCid(idHash, newEmergencyCid)` |
| Add / remove guardians (for recovery only) | IdentityRegistry | Yes | `addGuardian(guardian)`, `removeGuardian(guardian)` |
| Social recovery (guardians vote → new Lock A) | IdentityRegistry | Yes | `voteForRecovery(patient, proposedLockACid)`, `cancelRecovery()` |
| Register as patient (own records) | HealthRegistry | Yes | `registerPatient()` |
| Upload own records | HealthRegistry | Yes | `addRecord(patient, fileCid, fileType)` when `msg.sender == patient` |
| Grant access per record (only to verified clinician) | HealthRegistry | Yes | `grantAccess(recordId, grantee, encDekIpfsCid, newManifestCid)`; `require(verifier.isVerified(grantee))` |
| Revoke access per record | HealthRegistry | Yes | `revokeAccess(recordId, grantee, newManifestCid)` |
| Cannot grant to non-verified clinician | HealthRegistry | Yes | Enforced in `grantAccess` |
| Deactivate own record | HealthRegistry | Yes | `deactivateRecord(recordId)` onlyRecordPatient |
| Emergency Tier 1: mark records as break-glass | HealthRegistry | Yes | `addToEmergencyRecords(recordId)`, `removeFromEmergencyRecords(recordId, index)` |
| Rotate encryption key | HealthRegistry | Yes | `rotateEncryptionKey(newManifestCid)` onlyPatient |
| Veto Unconscious Protocol (during 30-min window) | HealthRegistry | Yes | `vetoUnconsciousProtocol(patient)` — patient **or** guardian (if `identityRegistry` is set and guardian is in IdentityRegistry.getGuardians(patient)) |
| Revoke unconscious access after recovery | HealthRegistry | Yes | `revokeUnconsciousAccess(hospital)` |

### 2.2 Doctor (on-chain rules)

| Required rule / capability | Where it must live | In contract? | Notes |
|----------------------------|--------------------|--------------|--------|
| Register identity (role=doctor, licenseHash) | IdentityRegistry | Yes | Same `register(..., role, licenseHash)` |
| One wallet per identity | IdentityRegistry | Yes | Same as patient |
| Verification (license) via IVerifier | HealthRegistry (and app) | Yes | `addRecord`, `grantAccess` (grantee), `requestAccess` use `verifier.isVerified(msg.sender)` or `verifier.isVerified(grantee)` |
| Request access to patient (on-chain) | HealthRegistry | Yes | `requestAccess(patient)` onlyVerifiedClinician |
| Add record for a patient (only if verified) | HealthRegistry | Yes | `addRecord(patient, fileCid, fileType)` when `verifier.isVerified(msg.sender)` |
| Cannot add record without being patient or verified | HealthRegistry | Yes | `require(msg.sender == patient \|\| verifier.isVerified(msg.sender))` |
| Trigger break-glass (Tier 1) for emergency | HealthRegistry | Yes | `triggerBreakGlass(patient)` onlyVerifiedClinician |
| Co-sign Unconscious Protocol (as staff) | HealthRegistry | Yes | `signUnconsciousProtocol(patient)` onlyVerifiedClinician |
| Cannot see records without grant | HealthRegistry / app | Yes | Access is per-record via DEK; contract only emits AccessGranted; no on-chain “view” without grant |

### 2.3 Hospital (on-chain rules)

| Required rule / capability | Where it must live | In contract? | Notes |
|----------------------------|--------------------|--------------|--------|
| Register identity (role=hospital) | IdentityRegistry | Yes | Same `register(..., role="hospital", licenseHash=0)` |
| Upload records for patients (clinical files) | HealthRegistry | Yes | Same as doctor: `addRecord(patient, fileCid, fileType)` when `verifier.isVerified(msg.sender)`; hospital address must be verified via IVerifier |
| Co-sign Unconscious Protocol | HealthRegistry | Yes | `signUnconsciousProtocol(patient)` onlyVerifiedClinician |
| Hospital does **not** mark "check up done" | App / Helia | N/A | Journey/checkpoint logic is on Helia; contracts have no "check up done". Correct by design. |

So: **hospital** is a **verified clinician** in HealthRegistry (same as doctor for addRecord, requestAccess, break-glass, unconscious). Role distinction (doctor vs hospital) is only in IdentityRegistry (`role` bytes32); both need `verifier.isVerified()` to act on HealthRegistry.

### 2.4 Guardian / family (on-chain rules)

| Required rule / capability | Where it must live | In contract? | Notes |
|----------------------------|--------------------|--------------|--------|
| Guardians are addresses (patient → list) | IdentityRegistry | Yes | `_guardians[patient]`, `addGuardian`, `removeGuardian`, `getGuardians(patient)` |
| Guardians can vote for social recovery | IdentityRegistry | Yes | `voteForRecovery(patient, proposedLockACid)`; requires `_isGuardian(patient, msg.sender)` |
| Guardians can veto Unconscious Protocol | HealthRegistry | Yes | `vetoUnconsciousProtocol(patient)` allows patient **or** guardian. `_isRegisteredGuardianOf` calls `IIdentityRegistry(identityRegistry).getGuardians(patient)`. Owner must call `setIdentityRegistry(identityRegistryAddress)` after deploy. |

### 2.5 Emergency (no login role)

| Required rule / capability | Where it must live | In contract? | Notes |
|----------------------------|--------------------|--------------|--------|
| Tier 0 profile (public) | IdentityRegistry + Helia | Yes | `emergencyCid` in Identity; content on Helia. |
| Tier 1 break-glass (verified doctor) | HealthRegistry | Yes | `emergencyRecords[patient]`, `triggerBreakGlass(patient)`. |
| Tier 2 Unconscious (2 staff, 30-min veto, 72h access) | HealthRegistry | Yes | `signUnconsciousProtocol`, `executeUnconsciousProtocol`, `vetoUnconsciousProtocol`, `unconsciousAccess`, `revokeUnconsciousAccess`. |

### 2.6 Rules intentionally **not** in contracts (by design)

| Rule | Where it lives | Notes |
|------|----------------|--------|
| Journey, session, visit, queue, token number | Helia (encrypted) | No journey/session on-chain; docs say Helia only. |
| "Check up done" (only allotted doctor) | Helia / app | Journey payload + doctor signature; not a contract call. |
| Patient cannot search other patients | App / UI | No contract method for "search patients". |
| Doctor sees only patients in their department | App / Helia | Journey data filtered by department; not contract. |
| Max 2 devices (Lock B) | App / device / Helia | Docs say implementation in app/Helia; contracts don’t enforce. |
| Family sharing (journey on/off, records on/off) | App / Helia | Sharing prefs and keys on Helia; guardians on-chain are for recovery only. |

### 2.7 Gaps and deployment note

| Item | Status | Notes |
|------|--------|--------|
| **Guardian veto for Unconscious Protocol** | Implemented | HealthRegistry has `identityRegistry` address and `setIdentityRegistry(address)` (onlyOwner). `_isRegisteredGuardianOf(patient, guardian)` calls `IIdentityRegistry(identityRegistry).getGuardians(patient)` and returns true if guardian is in the list. **Deployment:** After deploying HealthRegistry, owner must call `setIdentityRegistry(identityRegistryAddress)` so guardian veto is active. |
| **Optional: restrict registerPatient to role=patient** | Not implemented | HealthRegistry.`registerPatient()` can be called by any address. Optional hardening: require IdentityRegistry role=patient for msg.sender. |

Summary: **All role-specific rules required by the decentralisation architecture are implemented in the contracts.** Guardian veto is active once owner sets `identityRegistry` on HealthRegistry.

---

## 3. IdentityRegistry.sol — doc comparison

### ARCHITECTURE.md

| Doc | Contract | Status |
|-----|----------|--------|
| Identity: lockACid, lockCCid, recoveryKeyHash, emergencyCid, wallet, role, licenseHash, **verified** | Contract has **exists** (not verified) | Minor: doc said "verified"; contract uses "exists". Doctor verification is via **IVerifier** (separate), not in Identity. |
| lockACid, lockCCid as **bytes32** | Contract uses **string** (IPFS CID) | Preferable: IPFS CIDs are string in practice. |
| Guardians: patient → guardian wallets | `_guardians[patient]`, addGuardian, removeGuardian, voteForRecovery | Aligned. |
| Events: IdentityRegistered, LockAUpdated, GuardianAdded, RecoveryCompleted | Same + EmergencyCidUpdated, GuardianRemoved, RecoveryInitiated, RecoveryVoted, RecoveryCancelled | Contract has more; aligned. |
| IVerifier, DefaultVerifier | Same | Aligned. |

### DATA_STORAGE_AND_JOURNEY.md

- On-chain: "Identifier hash → lockACid, lockCCid, recoveryKeyHash, emergencyCid, wallet, role, licenseHash, exists" and "Guardians". Contract matches.
- Max 2 devices: doc says "Exact contract or IPFS schema is left to implementation". Contracts do not enforce; app/device/Helia enforce. Aligned.

### ROLES_AND_FLOWS.md

- Roles: patient, doctor, hospital in IdentityRegistry; contract has bytes32 role. Aligned.
- Guardians: IdentityRegistry.getGuardians; contract has getGuardians(patient). Aligned.

---

## 4. HealthRegistry.sol — doc comparison

### ARCHITECTURE.md

| Doc (original) | Doc (Security Fixes) | Contract | Status |
|----------------|----------------------|----------|--------|
| mapping recordId => doctor => bytes (DEK on-chain) | DEKs in **events only**; no bytes on-chain | accessManifestCid + AccessGranted(recordId, grantee, encDekIpfsCid) | Aligned (upgraded). |
| Record: metadata | Record: fileCid, patient, uploader, fileType, timestamp | Same + **active** | Aligned. |
| patientRecords, emergencyRecords, unconsciousAccess, hospitalStaffApprovals | Same | patientRecords, emergencyRecords, UnconsciousRequest, coSigned, unconsciousAccess | Aligned. |
| Events: RecordAdded, AccessGranted, AccessRevoked, AccessRequested, EmergencyAccessUsed, UnconsciousProtocolTriggered | — | RecordAdded, AccessGranted(encDekIpfsCid), AccessRevoked, AccessManifestUpdated, AccessRequested, BreakGlassUsed, UnconsciousCoSigned, UnconsciousTimelockStarted, UnconsciousAccessGranted, UnconsciousVetoed, UnconsciousAccessRevoked | Aligned (more granular). |
| addRecord by patient or verified | Same | addRecord(patient, fileCid, fileType); msg.sender == patient \|\| verifier.isVerified(msg.sender) | Aligned. |
| grantAccess / revokeAccess | encDekIpfsCid in event; newManifestCid | grantAccess(recordId, grantee, encDekIpfsCid, newManifestCid), revokeAccess(recordId, grantee, newManifestCid) | Aligned. |
| Unconscious: 30-min timelock, 2 staff, veto | Same | TIMELOCK_WINDOW 30 min, SIGN_THRESHOLD 2, vetoUnconsciousProtocol | Aligned. |

### DATA_STORAGE_AND_JOURNEY.md

- On-chain: "patients set, records (metadata), patientRecords, accessManifestCid, emergencyRecords, unconscious*, accessRequested, events". Contract matches.
- "File content and DEKs on Helia". Contract stores only metadata + CIDs; aligned.

### ROLES_AND_FLOWS.md

- Record metadata + accessManifestCid + DEK in AccessGranted event; grant/revoke. Contract matches.
- Verified clinician (IVerifier) for grant/request/addRecord. Contract uses verifier.isVerified; aligned.

### Guardian veto (family)

- **ROLES_AND_FLOWS / DATA_STORAGE:** Family/guardian can veto Unconscious Protocol.
- **Contract:** `vetoUnconsciousProtocol(patient)` allows msg.sender == patient **or** `_isRegisteredGuardianOf(patient, msg.sender)`. `_isRegisteredGuardianOf` calls `IIdentityRegistry(identityRegistry).getGuardians(patient)` and returns true if msg.sender is in the list. Owner must call `setIdentityRegistry(identityRegistryAddress)` after deploy for guardian veto to be active.

---

## 5. Journey / session (not on-chain)

All docs state: **journey and session data live on Helia** (encrypted); **no bulk journey/session on-chain**. Contracts do not define journey or session; only Identity + Health. Aligned.

---

## 6. Frontend ABI mismatch (action required)

| Location | Purpose | Matches |
|----------|---------|--------|
| **contracts/IdentityRegistry.sol** | Source of truth | — |
| **contracts/HealthRegistry.sol** | Source of truth | — |
| **src/lib/blockchain.ts** | Minimal ABI for Identity + Health (register, getIdentity, registerPatient, addRecord, grantAccess, revokeAccess, getPatientRecords, getRecord, etc.) | **Yes** — matches new contracts. |
| **src/lib/contracts.ts** | HEALTH_RECORDS_ABI, HEALTH_RECORDS_ADDRESS | **No** — old HealthRecords (Patient struct, uint256 recordId, grantDoctorAccess, createRecord(patient, recordHash), etc.). Does **not** match HealthRegistry.sol. |

**Recommendation:**

1. Use **blockchain.ts** (getHealthContract, getIdentityContract) and env **NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS** / **NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS** for all on-chain health/identity calls.
2. Migrate **src/components/upload-record.tsx** and **src/lib/web3.ts** off **HEALTH_RECORDS_ABI** / **HEALTH_RECORDS_ADDRESS** from contracts.ts to the HealthRegistry ABI and address from **blockchain.ts** (or a single Health ABI export derived from HealthRegistry.sol).
3. Deprecate or remove **HEALTH_RECORDS_ABI** and **HEALTH_RECORDS_ADDRESS** from **src/lib/contracts.ts** once no callers remain.

---

## 7. Checklist

- [x] IdentityRegistry: roles, locks, guardians, recovery, IVerifier — aligned with ARCHITECTURE, DATA_STORAGE, ROLES_AND_FLOWS.
- [x] HealthRegistry: records metadata, accessManifestCid, DEK in events, grant/revoke, emergency tiers, Unconscious Protocol — aligned.
- [x] Journey/session: not in contracts; on Helia per docs — aligned.
- [x] Max 2 devices: not in contracts; app/Helia — aligned.
- [ ] **Frontend:** Replace legacy contracts.ts Health ABI/address with blockchain.ts + new HealthRegistry ABI so app matches deployed contracts.
- [x] **Guardian veto:** HealthRegistry now has identityRegistry + setIdentityRegistry() and _isRegisteredGuardianOf() calls IdentityRegistry.getGuardians(patient). Owner must set identityRegistry after deploy.
