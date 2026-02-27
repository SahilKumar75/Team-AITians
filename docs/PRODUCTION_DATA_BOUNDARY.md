# Production Data Boundary (Mandatory)

This project must follow this boundary in all features and roles:

## On-chain (minimal only)
- Ownership
- Permissions
- Hashes / CIDs / pointers
- Audit events

Never store full profile/record/journey/voice payloads on-chain.

## IPFS (full encrypted payloads)
- Profiles
- Records
- Journey / session payloads
- Voice reports

## Why this is mandatory
- Lower gas
- Faster UX
- Decentralized integrity (on-chain anchored CIDs/hashes)

## Guardrails implemented
- CID pointer validation before on-chain writes in:
  - `src/lib/blockchain.ts`
  - `src/app/api/auth/register-on-chain/route.ts`

If a new feature writes on-chain data, it must write pointers/hashes only.
