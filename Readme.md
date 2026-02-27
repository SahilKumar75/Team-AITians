
# Swasthya Sanchar

A decentralized medical records system built on Polygon Amoy and IPFS.
Patients own their data, encrypted with their private keys. No central database.

## Installation

1. Clone the repository
2. Install dependencies:
   npm install

3. Create .env.local file:
   NEXT_PUBLIC_POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
   NEXT_PUBLIC_POLYGON_CHAIN_ID=80002

4. Run locally:
   npm run dev

## Architecture

- Frontend: Next.js 14 (React)
- Smart Contracts: Solidity (Polygon Amoy)
- Storage: IPFS (via Helia) + IndexedDB (Local Keys)
- Auth: Argon2id (Slow Hash) + AES-256-GCM (Encryption)

## Status

- Phase 1: Architecture (Complete)
- Phase 2: Authentication (Complete)
- Phase 3: Medical Records (Pending)
