import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getIdentityContract, isLikelyCid } from '@/lib/blockchain';
import { normalizeIdentifier } from '@/lib/identifier';

// Environment variables
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';

/**
 * server-side function to handle gas-less registration.
 * Uses the DEPLOYER_PRIVATE_KEY to sign and pay for the transaction.
 */
export async function POST(request: Request) {
    try {
        if (!DEPLOYER_KEY) {
            return NextResponse.json({ error: "Server misconfiguration: No deployer key" }, { status: 500 });
        }

        const body = await request.json();
        const { identifier, address, lockACid, lockCCid, recoveryKeyHash, emergencyCid, role, licenseHash } = body;

        // Validate inputs
        if (!identifier || !address || !lockACid || !lockCCid || !recoveryKeyHash || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        if (!isLikelyCid(lockACid) || !isLikelyCid(lockCCid)) {
            return NextResponse.json(
                { error: "Invalid lock CID(s). On-chain accepts only CID pointers." },
                { status: 400 }
            );
        }
        if (emergencyCid && !isLikelyCid(emergencyCid)) {
            return NextResponse.json(
                { error: "Invalid emergency CID. On-chain accepts only CID pointers." },
                { status: 400 }
            );
        }

        // 1. Setup Provider & Deployer Wallet
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const deployerWallet = new ethers.Wallet(DEPLOYER_KEY, provider);

        // 2. Connect to Contract with Signer
        const contract = getIdentityContract(deployerWallet);

        // 3. Compute Identifier Hash (keccak256 of normalized email/phone)
        const norm = normalizeIdentifier(identifier);
        const idHash = ethers.keccak256(ethers.toUtf8Bytes(norm));

        // 4. Send Transaction
        // "register(bytes32 idHash, string lockA, string lockC, bytes32 recHash, string emerCid, bytes32 role, bytes32 licHash)"
        const tx = await contract.register(
            idHash,
            lockACid,
            lockCCid,
            recoveryKeyHash,
            emergencyCid,
            ethers.toUtf8Bytes(role), // Role is bytes32, string "patient" fits.
            licenseHash || ethers.ZeroHash
        );

        // 5. Wait for confirmation?
        // For speed, just return the hash. Front-end can wait.

        return NextResponse.json({ success: true, txHash: tx.hash });

    } catch (e: any) {
        console.error("Registration on-chain failed:", e);
        return NextResponse.json({ error: e.message || "Transaction failed" }, { status: 500 });
    }
    // return the hash
}
