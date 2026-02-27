# Swasthya Sanchar — Implementation Plan

> Plan to complete the app per [ARCHITECTURE.md](./ARCHITECTURE.md).  
> **Decentralised:** No third-party services except emergency SMS (Fast2SMS). Frontend deployed on **Helia** (IPFS). Our own IPFS node for pinning. Identifier = **email OR phone** with password.

---

## Decisions (from product)

| Item | Choice |
|------|--------|
| **Identifier** | Email OR phone (single field); normalized for storage and on-chain hash |
| **Recovery** | Same device (Lock B), new device (24-word phrase), family (2 guardians), multi-device (login with email/phone + password) |
| **Doctor search** | By email or phone (name search requires index; coming later) |
| **Emergency contact** | Always a phone number |
| **Notifications** | Third-party (Fast2SMS) for ICE/emergency SMS only |
| **Frontend** | Deploy on Helia (IPFS) |
| **IPFS** | Our own node (`IPFS_API_URL`); no Pinata |

---

## Phase 1 — Foundation (libs + API)

| # | Task | Status |
|---|------|--------|
| 1.1 | `src/lib/compression.ts` — Brotli WASM | Done |
| 1.2 | `src/lib/ipfs-node.ts` — Our IPFS node (Kubo /api/v0/add, cat) | Done |
| 1.3 | `src/app/api/ipfs/upload/route.ts` — Pin to our node | Done |
| 1.4 | `src/app/api/ipfs/fetch/[cid]/route.ts` — Fetch by CID | Done |
| 1.5 | `src/app/api/notify/route.ts` — Fast2SMS (third-party for ICE only) | Done |

## Phase 2 — Crypto & identity

| # | Task | Status |
|---|------|--------|
| 2.1 | `src/lib/identifier.ts` — normalize email/phone, isValidIdentifier, isValidPhone | Done |
| 2.2 | `src/lib/crypto-identity.ts` — identifier = email OR phone, normalized | Done |
| 2.3 | `src/lib/blockchain.ts` + register-on-chain — normalize identifier before keccak256 | Done |
| 2.4 | `src/lib/crypto-files.ts` — DEK envelope encryption | Done |
| 2.5 | Wire upload flow: API pin → HealthRegistry.addRecord (getSigner) | Done |
| 2.6 | Argon2id in crypto-identity (replace SHA-256) | Done |

## Phase 3 — Patient pages (UI shells + wiring)

| # | Route | Purpose | Status |
|---|-------|---------|--------|
| 3.1 | `/patient/records` | All files + per-doctor access | Done (shell) |
| 3.2 | `/patient/upload` | Upload personal docs | Done (shell + modal) |
| 3.3 | `/patient/access` | Per-document share/revoke | Done (shell) |
| 3.4 | `/patient/emergency` | QR / NFC / tier settings; emergency contact = phone | Done (shell) |
| 3.5 | `/patient/family` | Add/remove guardians | Done (shell) |
| 3.6 | `/patient/download` | Download records | Done (shell) |
| 3.7 | `/patient/audit` | Access log | Done (shell) |

## Phase 4 — Auth & recovery

| # | Task | Status |
|---|------|--------|
| 4.1 | Login/register: single field "Email or phone" + password | Done |
| 4.2 | `/auth/recover` — Same device (Lock B), phrase (Lock C), family guardians, multi-device note | Done |
| 4.3 | Wire `unlockWithRecoveryPhrase` (phrase hash → identity key at creation) | Done |
| 4.4 | Lock B / WebAuthn for same-device recovery | Done |

## Phase 5 — Doctor / Hospital / Emergency

| # | Task | Status |
|---|------|--------|
| 5.1 | Doctor search: `GET /api/doctor/search?q=email_or_phone` | Done |
| 5.2 | Doctor UI: search by email or phone on doctor home | Done |
| 5.3 | Hospital: bulk upload, manage patients | Done |
| 5.4 | Emergency: Tier 0 public page; Tier 1/2 + unconscious + ICE SMS | Done |

## Phase 6 — Polish

| # | Task | Status |
|---|------|--------|
| 6.1 | `src/lib/local-db.ts` — RxDB local-first | Done |
| 6.2 | WebAuthn for Lock B | Done |
| 6.3 | Emergency contact: validate with isValidPhone on save (patient + patient-portal) | Done |

---

## Deployment

- **Frontend:** Deploy on **Helia** (IPFS). Build as static or use Fleek/other that deploys to IPFS.
- **IPFS pinning:** Our own node. Set `IPFS_API_URL` (e.g. `http://localhost:5001` for Kubo) so API routes can pin.
- **Contracts:** Polygon Amoy. Set `NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS`, `NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS`, `POLYGON_RPC_URL`, `POLYGON_CHAIN_ID`.
- **Notify:** Set `FAST2SMS_API_KEY` for emergency SMS only (third-party).

User is the true owner of data; Helia is used for frontend deployment only.
