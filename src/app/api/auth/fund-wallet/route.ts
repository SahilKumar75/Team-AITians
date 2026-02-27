import { NextResponse } from "next/server";
import { ethers } from "ethers";

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const RPC_URL = process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology";
const SPONSOR_AMOUNT = process.env.REGISTRATION_GAS_SPONSOR_AMOUNT || "0.03";

export async function POST(request: Request) {
    try {
        if (!DEPLOYER_KEY) {
            return NextResponse.json({ error: "Server misconfiguration: no deployer key" }, { status: 500 });
        }
        const body = await request.json().catch(() => ({}));
        const address = typeof body?.address === "string" ? body.address.trim() : "";
        if (!address || !ethers.isAddress(address)) {
            return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const sponsor = new ethers.Wallet(DEPLOYER_KEY, provider);
        const current = await provider.getBalance(address);
        // Accept optional minimum from caller; default to 0.005 for backward compat (registration).
        const minRequired = body?.minRequired && typeof body.minRequired === "string"
            ? ethers.parseEther(body.minRequired)
            : ethers.parseEther("0.005");
        if (current >= minRequired) {
            return NextResponse.json({ success: true, skipped: true, reason: "already-funded" });
        }

        const value = ethers.parseEther(SPONSOR_AMOUNT);
        const tx = await sponsor.sendTransaction({ to: address, value });
        await tx.wait();
        return NextResponse.json({ success: true, txHash: tx.hash, funded: SPONSOR_AMOUNT });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Funding failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

