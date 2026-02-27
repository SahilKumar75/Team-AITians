# 🏥 Swasthya Sanchar — Architecture & Implementation Plan

> **Decentralised Medical Records System**  
> Patient-sovereign, blockchain-anchored, no third-party auth.

---

## 📌 Project Overview

Build a decentralised platform for storing and sharing medical records securely.  
- Patients control ALL access permissions at the **per-document level**  
- Doctors/hospitals can view only what the patient explicitly authorises  
- Emergency responders get instant critical info via **QR code / NFC tag**  
- Zero MetaMask. Zero blockchain knowledge required. Just email + password.

---

## 🗂️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Same as old project |
| Blockchain | Polygon Amoy Testnet | Deployed, fast, cheap |
| IPFS | Helia (self-hosted, no Pinata) | No third-party APIs |
| Local DB | RxDB (IndexedDB) | Instant load, offline-first |
| Compression | Brotli WASM | 40-60% smaller IPFS payloads |
| Auth Crypto | Web Crypto API + noble/hashes | No third-party auth |
| Hosting | Fleek.co (deploys to IPFS) | No Vercel, truly decentralised |

---

## 🔐 Authentication — Invisible Blockchain Identity

> Users see: Email + Password  
> Under the hood: A crypto wallet is silently generated and managed

### Triple-Lock System

```
Random Private Key (Wallet = Identity)
         │
    ┌────┴──────┬───────────────┐
    ▼           ▼               ▼
🔒 Lock A    🔒 Lock B       🔒 Lock C
Password     Device Key      Recovery Phrase (24 words)
AES(key,pwd) AES(key,devKey) AES(key,phrase)
    │           │               │
    ▼           ▼               ▼
IPFS (public) IndexedDB      IPFS (public)
via Helia     only           via Helia
    │                           │
    └──────────┬────────────────┘
               ▼
    Smart Contract: hash(email) → { lockA_cid, lockC_cid, hash(phrase) }
```

### Login Modes

| Mode | How | When |
|---|---|---|
| Normal (any device) | Email + Password → fetch Lock A from IPFS → decrypt | Any device |
| Fast (trusted device) | Fingerprint/FaceID (WebAuthn) → unlock Lock B from IndexedDB | Same device |
| Guest (shared device) | Email + Password → session only, nothing saved | Cyber cafe / borrowed device |
| Forgot password (same device) | Unlock Lock B → set new password → new Lock A | Phone available |
| Forgot password (new device) | Enter 24-word recovery phrase → unlock Lock C | Phrase available |
| Family recovery | 2 guardians approve on-chain → new Lock A generated | Lost everything |

---

## 👥 User Roles

| Role | Description |
|---|---|
| **Patient** | Uploads own docs, grants/revokes per-document access, manages family/guardians |
| **Doctor** | Searches patient by email → requests access → views/uploads clinical records |
| **Hospital** | Separate role. Uploads clinical files (X-rays, blood reports) for their patients |
| **Family / Guardian** | Linked by patient. Used for social recovery only |

### Doctor Verification (Free)
- Doctor submits their **medical license number** at registration
- License hash stored on-chain: `keccak256(licenseNumber)`
- Admin (us) verifies once and sets `verified = true`
- Architecture supports upgrading to **Polygon ID ZK-proofs** later with no contract changes

---

## 📄 Per-Document Access Control (Envelope Encryption)

Every file has its own **Data Encryption Key (DEK)**. Sharing = giving doctor the DEK, not the file.

```
UPLOAD:
  file → Brotli compress → AES_Encrypt(file, DEK) → IPFS → CID
  AES_Encrypt(DEK, patient_publicKey) → patient_DEK_lock (always kept by patient)

SHARE with Dr. Sharma:
  Patient decrypts DEK → AES_Encrypt(DEK, drSharma_publicKey) → drSharma_DEK_lock
  Smart contract: recordAccess[recordId][drSharma] = drSharma_DEK_lock

DR. SHARMA VIEWS:
  Fetch drSharma_DEK_lock → decrypt with drSharma_privateKey → DEK
  Fetch encrypted file from IPFS → decrypt with DEK → original file ✅

REVOKE Dr. Patel:
  Smart contract: delete recordAccess[recordId][drPatel]
  Dr. Patel can no longer get the DEK — file is inaccessible ✅
```

**Patient's record view:**
```
📄 Blood Report — Jan 2025
  Shared with: Dr. Sharma ✅ | Dr. Patel ❌ (Revoked)
  [Share] [Revoke] [Download] [Add to Emergency Tier 1]
```

## 🔒 Security Model (All Issues Fixed)

| Issue | Vulnerability | Fix Applied |
|---|---|---|
| **1. Offline Dictionary Attack** | Lock A on public IPFS — can be brute-forced offline | **Argon2id** (64MB RAM/guess) replaces PBKDF2. GPU farms throttled to ~1,000 guesses/sec |
| **2. Future Crypto Exposure** | IPFS data permanent, future quantum breaks encryption | **AES-256-GCM** (quantum-safe: 128-bit effective vs quantum). Built-in `rotateEncryptionKey()` function |
| **3. Expensive On-Chain DEKs** | `mapping(recordId → doctor → bytes)` = on-chain bytes = $$$  | **DEKs emitted in events only** — IPFS CID in `AccessGranted` event. Zero bytes in state. O(1) gas |
| **4. QR Privacy Leak** | Static URL on physical card → anyone can photograph | **Minimal Tier-0 by default** — blood group + allergies only. No name unless opt-in |
| **5. Staff Collusion** | 2 corrupt employees bypass unconscious protocol | **30-min timelock + family veto**. ICE auto-SMS on first signature. Veto cancels access |
| **6. Browser IPFS Unreliable** | Browser tab closes → IPFS upload fails | **Server-side pinning only**. Browser encrypts, sends to API. Server pins to IPFS |
| **7. Centralized Verification** | Manual admin = single point of failure | **`IVerifier` interface** — swap manual → Kleros → Chainlink with one tx, zero redeployment |
| **8. Mobile Memory Crash** | 200MB CT scan in browser RAM = crash | **1MB chunked streaming**. Never full file in memory. Server assembles + pins |

---

### Argon2id Parameters (Issue 1 Detail)
```typescript
const key = await argon2id({
  password: userPassword,
  salt: randomSalt,           // 16 bytes, stored in identity
  memory: 65536,              // 64MB RAM required per guess
  iterations: 3,
  parallelism: 4,
  hashLength: 32              // 256-bit AES key
})
// Result: AES-256-GCM key — used to encrypt/decrypt wallet private key
```

### Gas Cost Comparison (Issue 3 Detail)
```
OLD: mapping(recordId => doctorAddr => bytes encDEK)
  1,000 records × 10 doctors = 10,000 mappings × ~20,000 gas = 200M gas = ~$400

NEW: emit AccessGranted(recordId, doctor, ipfsCid)
  1,000 records × 10 doctors = 10,000 events × ~375 gas = 3.75M gas = ~$0.75
  SAVINGS: 99.6%
```

### Unconscious Protocol Flow (Issue 5 Detail)
```
T+0m  Staff_A signs → server sends ICE SMS instantly
T+5m  Staff_B signs → 30-min veto window opens
       On-chain: UnconsciousTimelockStarted emitted
T+10m Family receives SMS, can call vetoUnconsciousProtocol()
T+35m If no veto → anyone calls executeUnconsciousProtocol()
       On-chain: access opens, 72h expiry set
T+72h Access auto-expires. Patient can revoke anytime.
```

### ICE Auto-Notification
When Tier 1 or Tier 2 is triggered:
- Automatic SMS/WhatsApp sent to patient's emergency contact (via Fast2SMS free tier)
- Message: *"Your contact [Name] was admitted in an emergency. Hospital: [X]. Time: [Y].*

### Emergency Profile Fields

**Mandatory (cannot hide):**
- Name, DOB, Age, Blood group, Emergency contact, Primary language

**Tier 0 Add-ons (patient's choice — public):**
- Current medications, known conditions, organ donor status

**Tier 1 — Pre-approved for ER doctors:**
- Any specific documents patient marks as emergency-accessible
- e.g., "Last diagnosis", "Surgical history"

**Tier 2 — Unconscious Protocol:**
- Toggle: ON/OFF (default OFF, patient must opt in)
- Requires 2 hospital staff co-signatures to activate
- 72h auto-expiry

---

## 📡 NFC Tag Support

```
QR code encodes: https://yourapp.com/emergency/<patient_id>
NFC tag stores:  https://yourapp.com/emergency/<patient_id>  ← same URL
```

- Patient taps phone to NFC sticker → writes the URL (Web NFC API)
- Paramedic taps Android phone to sticker → emergency page opens instantly
- iPhone fallback: scan QR code (universal)

---

## 🏗️ Smart Contracts

### `IdentityRegistry.sol` (NEW)
```solidity
struct Identity {
    bytes32 lockACid;        // AES(privKey, password) → IPFS
    bytes32 lockCCid;        // AES(privKey, recoveryPhrase) → IPFS
    bytes32 recoveryKeyHash; // keccak256(phrase) for verification
    bytes32 emergencyCid;    // Tier 0 public profile on IPFS
    address wallet;
    bytes32 role;            // patient | doctor | hospital
    bytes32 licenseHash;     // doctors: keccak256(licenseNumber)
    bool verified;
}
mapping(bytes32 => Identity) public identities; // keccak256(email/phone) → Identity
mapping(address => address[]) public guardians; // patient → guardian wallets

// Events
event IdentityRegistered(bytes32 emailHash, address wallet, bytes32 role);
event LockAUpdated(bytes32 emailHash, bytes32 newCid);
event GuardianAdded(address patient, address guardian);
event RecoveryCompleted(address patient);
```

### `HealthRegistry.sol` (UPGRADED)
```solidity
// Per-record per-doctor encrypted DEK
mapping(bytes32 => Record) public records;
mapping(bytes32 => mapping(address => bytes)) public recordAccess;
mapping(address => bytes32[]) public patientRecords;
mapping(address => bytes32[]) public emergencyRecords; // Tier 1 pre-approved

// Emergency
mapping(address => mapping(address => uint256)) public unconsciousAccess; // patient → hospital → expiry
mapping(address => mapping(address => uint8)) public hospitalStaffApprovals;

// Events (10x cheaper than state storage)
event RecordAdded(address indexed patient, address indexed uploader, bytes32 recordId, bytes32 fileCid, bytes32 fileType, uint256 timestamp);
event AccessGranted(bytes32 indexed recordId, address indexed doctor);
event AccessRevoked(bytes32 indexed recordId, address indexed doctor);
event AccessRequested(address indexed patient, address indexed doctor);
event EmergencyAccessUsed(address indexed patient, address indexed doctor, uint256 timestamp);
event UnconsciousProtocolTriggered(address indexed patient, address indexed hospital, uint256 timestamp);
```

---

## 📁 New Files to Create

### Crypto & Auth
| File | Purpose |
|---|---|
| `src/lib/crypto-identity.ts` | Triple-lock: createIdentity, unlockWith* |
| `src/lib/crypto-files.ts` | DEK-based envelope encryption for file uploads |
| `src/lib/compression.ts` | Brotli WASM compress/decompress |
| `src/lib/device-storage.ts` | IndexedDB: DeviceKey, Lock B, WebAuthn |
| `src/lib/helia.ts` | IPFS upload/fetch via self-hosted Helia node |
| `src/lib/local-db.ts` | RxDB local-first cache setup |
| `src/lib/blockchain.ts` | Update: both new contract addresses |
| `src/contexts/AuthContext.tsx` | Replaces WalletContext (no MetaMask!) |

### API Routes
| Route | Purpose |
|---|---|
| `src/app/api/ipfs/upload/route.ts` | Server-side Helia pin |
| `src/app/api/ipfs/fetch/[cid]/route.ts` | Retrieve by CID |
| `src/app/api/notify/route.ts` | SMS/WhatsApp emergency notification |

### Pages
| Route | Who | What |
|---|---|---|
| `/auth/register` | All | Phone/email + password, role selection |
| `/auth/login` | All | Password + WebAuthn + guest mode |
| `/auth/recover` | Patient | Recovery phrase OR family guardian |
| `/patient` | Patient | Dashboard |
| `/patient/records` | Patient | All files + per-doctor access view |
| `/patient/upload` | Patient | Upload personal docs |
| `/patient/access` | Patient | Per-document share/revoke |
| `/patient/emergency` | Patient | Configure QR / NFC / tier settings |
| `/patient/family` | Patient | Add/remove guardians |
| `/patient/download` | Patient | Download all or specific records |
| `/patient/audit` | Patient | Access log (who accessed what, when) |
| `/doctor` | Doctor | Search patient by email, request access |
| `/doctor/patients` | Doctor | All authorised patients |
| `/doctor/upload` | Doctor | Upload clinical files |
| `/hospital` | Hospital | Manage patients, bulk upload |
| `/emergency/[id]` | **Public** | Tier 0 view — zero auth |

---

## 📦 npm Packages to Install

```bash
npm install helia @helia/unixfs @helia/json blockstore-idb datastore-idb
npm install idb bip39 @noble/hashes @noble/curves brotli-wasm rxdb
# Already installed: ethers qrcode.react
```

---

## 🌐 Decentralised Hosting (No Vercel)

| Layer | Tool | Cost |
|---|---|---|
| Frontend + API routes | **Fleek.co** (Next.js → IPFS) | Free |
| IPFS pinning | Helia runs inside the app | Free |
| Blockchain | Polygon Amoy Testnet | Free (test MATIC) |
| Domain/URL | IPNS via Fleek | Free |

---

## 🚀 Implementation Order

1. **Deploy contracts** — `IdentityRegistry.sol` + upgraded `HealthRegistry.sol` to Polygon Amoy
2. **Auth layer** — `crypto-identity.ts`, `device-storage.ts`, `AuthContext.tsx`
3. **IPFS layer** — `helia.ts`, API routes for upload/fetch
4. **Registration & Login pages** — wire auth to UI
5. **Patient dashboard** — records, upload, access control
6. **Doctor dashboard** — search, request, view
7. **Hospital dashboard** — upload clinical records
8. **Emergency pages** — Tier 0 public page, configure tiers
9. **Family/Recovery flow** — guardians, social recovery
10. **Polish** — RxDB local-first, Brotli, WebAuthn biometric

---

## ⚙️ Environment Variables Needed

```env
# Polygon
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_CHAIN_ID=80002
DEPLOYER_PRIVATE_KEY=<your wallet private key>
NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=<deploy this>
NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS=<deploy this>

# SMS notifications
FAST2SMS_API_KEY=<free from fast2sms.com>
```

---

## ✅ Data Ownership — Is the Patient Truly the Owner?

| Dimension | Traditional App | Swasthya Sanchar |
|---|---|---|
| Who holds the key? | The company | The patient (on their device) |
| Can developer reset password? | ✅ Yes | ❌ Mathematically impossible |
| Can doctor access without permission? | Maybe | ❌ No — on-chain access control |
| Server hacked = data exposed? | ✅ Yes | ❌ Server holds encrypted blobs only |
| Data portable? | ❌ Vendor lock-in | ✅ Wallet = portable identity |
| Can patient delete data? | Maybe | ✅ Revoke all access, data is useless |
| Emergency access controlled by patient? | ❌ Company decides | ✅ Patient configures all tiers |
