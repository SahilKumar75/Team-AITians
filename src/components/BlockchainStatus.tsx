"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { ethers } from "ethers";

const EXPECTED_CHAIN_ID = BigInt(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || "80002");
const CHAIN_NAME = "Polygon Amoy";

export function BlockchainStatus() {
    const [status, setStatus] = useState<"loading" | "connected" | "wrong-network" | "disconnected">("loading");
    const [currentChainId, setCurrentChainId] = useState<bigint | null>(null);

    useEffect(() => {
        async function checkNetwork() {
            try {
                const provider = new ethers.JsonRpcProvider(
                    process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology"
                );
                const network = await provider.getNetwork();

                setCurrentChainId(network.chainId);

                if (network.chainId === EXPECTED_CHAIN_ID) {
                    setStatus("connected");
                } else {
                    setStatus("wrong-network");
                }
            } catch (err) {
                console.error("Failed to connect to blockchain:", err);
                setStatus("disconnected");
            }
        }

        checkNetwork();
        const interval = setInterval(checkNetwork, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    if (status === "connected") return null;

    return (
        <div className={`w-full py-2 px-4 flex items-center justify-center gap-3 text-sm font-medium transition-all ${status === "wrong-network" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
            }`}>
            {status === "loading" ? (
                <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying blockchain connection...</span>
                </>
            ) : status === "wrong-network" ? (
                <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                        Wrong Network! Expected {CHAIN_NAME} (ID: {EXPECTED_CHAIN_ID.toString()}),
                        found ID: {currentChainId?.toString()}.
                    </span>
                </>
            ) : (
                <>
                    <WifiOff className="w-4 h-4" />
                    <span>Cannot connect to blockchain. Please check your internet or RPC settings.</span>
                </>
            )}
        </div>
    );
}
