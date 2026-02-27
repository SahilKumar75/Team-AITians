"use client";

import { createPublicClient, createWalletClient, custom, http, type PublicClient, type WalletClient, defineChain } from "viem";
import { HEALTH_RECORDS_ABI, HEALTH_RECORDS_ADDRESS } from "./contracts";

// Define Hardhat local chain with correct chain ID (31337)
const hardhatLocal = defineChain({
  id: 31337,
  name: 'Hardhat Local',
  network: 'hardhat',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
});

// Types
export interface WalletConnection {
  account: `0x${string}`;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

// Check if MetaMask is installed
export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as any).ethereum !== "undefined";
}

// Logout - set flag in localStorage to prevent auto-reconnect
export function disconnectWallet(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("wallet_disconnected", "true");
  }
}

// Clear logout flag - called when user explicitly connects
export function clearDisconnectFlag(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("wallet_disconnected");
  }
}

// Check if user has logged out
export function isWalletDisconnected(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("wallet_disconnected") === "true";
}

// Connection lock to prevent duplicate requests
let isConnecting = false;
let connectionPromise: Promise<WalletConnection | null> | null = null;

// Connect to MetaMask and get the current account
export async function connectWallet(): Promise<WalletConnection | null> {
  console.log("[connectWallet] Starting connection process...");

  // If already connecting, return the existing promise
  if (isConnecting && connectionPromise) {
    console.log("[connectWallet] Connection already in progress, waiting...");
    return connectionPromise;
  }

  // Set lock and create new connection promise
  isConnecting = true;
  connectionPromise = performConnection();

  try {
    const result = await connectionPromise;
    return result;
  } finally {
    isConnecting = false;
    connectionPromise = null;
  }
}

// Actual connection logic
async function performConnection(): Promise<WalletConnection | null> {

  if (!isMetaMaskInstalled()) {
    alert("Please install MetaMask to use this application");
    return null;
  }

  // Check if user has explicitly disconnected
  if (isWalletDisconnected()) {
    console.log("[connectWallet] User has disconnected wallet, skipping auto-connect");
    return null;
  }

  try {
    const ethereum = (window as any).ethereum;
    let accounts: string[] = [];

    // First, try to get current accounts without requesting (silent check)
    try {
      console.log("[connectWallet] Checking for existing accounts...");
      accounts = await ethereum.request({ method: 'eth_accounts' });
      console.log("[connectWallet] Found accounts:", accounts.length);
    } catch (err) {
      console.log("[connectWallet] Could not get current accounts:", err);
    }

    // If no accounts, request connection
    if (accounts.length === 0) {
      console.log("[connectWallet] No accounts found, requesting connection...");
      try {
        accounts = await ethereum.request({ method: "eth_requestAccounts" });
        console.log("[connectWallet] User approved connection, accounts:", accounts.length);
      } catch (error: any) {
        if (error.code === 4001) {
          console.log("[connectWallet] User rejected the connection request");
        } else {
          console.error("[connectWallet] Error requesting accounts:", error);
        }
        return null;
      }
    }

    if (accounts.length === 0) {
      console.log("[connectWallet] No accounts available");
      return null;
    }

    // Check and switch network if needed (non-blocking)
    try {
      console.log("[connectWallet] Checking network...");
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      console.log("[connectWallet] Current chainId:", chainId);

      // Only switch if not already on Hardhat network
      if (chainId !== '0x7a69') {
        console.log("[connectWallet] Switching to Hardhat network...");
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x7a69" }],
          });
          console.log("[connectWallet] Network switched successfully");
        } catch (switchError: any) {
          // If the chain hasn't been added to MetaMask
          if (switchError.code === 4902) {
            console.log("[connectWallet] Network not found, adding Hardhat network...");
            try {
              await ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0x7a69",
                    chainName: "Localhost 8545",
                    rpcUrls: ["http://127.0.0.1:8545"],
                    nativeCurrency: {
                      name: "ETH",
                      symbol: "ETH",
                      decimals: 18,
                    },
                  },
                ],
              });
              console.log("[connectWallet] Network added successfully");
            } catch (addError) {
              console.error("[connectWallet] Failed to add network:", addError);
            }
          } else if (switchError.code === 4001) {
            console.log("[connectWallet] User rejected network switch");
          } else {
            console.error("[connectWallet] Network switch error:", switchError);
          }
        }
      } else {
        console.log("[connectWallet] Already on Hardhat network");
      }
    } catch (networkError) {
      console.error("[connectWallet] Network check failed:", networkError);
      // Continue anyway - network issues shouldn't block connection
    }

    // Clear logout flag when user explicitly connects
    clearDisconnectFlag();

    // Use the accounts we already fetched earlier
    const account = accounts[0] as `0x${string}`;

    // Create public client for reading blockchain data
    const publicClient = createPublicClient({
      chain: hardhatLocal,
      transport: http(),
    });

    // Create wallet client for signing transactions
    const walletClient = createWalletClient({
      account,
      chain: hardhatLocal,
      transport: custom((window as any).ethereum),
    });

    return {
      account,
      publicClient: publicClient as any,
      walletClient: walletClient as any,
    };
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    return null;
  }
}

// Get the current connected account without requesting connection
export async function getCurrentAccount(): Promise<`0x${string}` | null> {
  if (!isMetaMaskInstalled()) return null;

  // Check if user has logged out
  if (isWalletDisconnected()) return null;

  try {
    const accounts = await (window as any).ethereum.request({
      method: "eth_accounts",
    });

    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error("Failed to get current account:", error);
    return null;
  }
}

// Listen for account changes
export function onAccountsChanged(callback: (accounts: string[]) => void) {
  if (!isMetaMaskInstalled()) return;

  (window as any).ethereum.on("accountsChanged", callback);
}

// Contract interaction helpers
export async function readContract(
  connection: WalletConnection,
  functionName: string,
  args?: readonly unknown[]
) {
  return (connection.publicClient as any).readContract({
    address: HEALTH_RECORDS_ADDRESS,
    abi: HEALTH_RECORDS_ABI,
    functionName: functionName as any,
    args: args as any,
  });
}

export async function writeContract(
  connection: WalletConnection,
  functionName: string,
  args?: readonly unknown[]
) {
  try {
    console.log("Writing contract:", { functionName, args, account: connection.account });

    // Simulate the contract call first to check for errors
    const { request } = await connection.publicClient.simulateContract({
      address: HEALTH_RECORDS_ADDRESS,
      abi: HEALTH_RECORDS_ABI,
      functionName: functionName as any,
      args: args as any,
      account: connection.account,
    });

    console.log("Simulation successful, writing to contract...");

    // Write to the contract
    const hash = await connection.walletClient.writeContract(request);

    console.log("Transaction sent:", hash);

    // Wait for transaction confirmation
    const receipt = await connection.publicClient.waitForTransactionReceipt({
      hash,
    });

    console.log("Transaction confirmed:", receipt);

    return receipt;
  } catch (error: any) {
    console.error("Contract write error:", error);
    console.error("Error details:", {
      message: error.message,
      cause: error.cause,
      shortMessage: error.shortMessage,
    });
    throw error;
  }
}

// Create read-only public client (no wallet required)
export function createReadOnlyClient(): PublicClient {
  return createPublicClient({
    chain: hardhatLocal,
    transport: http(),
  }) as any;
}

// Read contract without wallet connection (for emergency access)
export async function readContractPublic(
  functionName: string,
  args?: readonly unknown[]
) {
  const publicClient = createReadOnlyClient();
  return (publicClient as any).readContract({
    address: HEALTH_RECORDS_ADDRESS,
    abi: HEALTH_RECORDS_ABI,
    functionName: functionName as any,
    args: args as any,
  });
}

// Format address for display
export function formatAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
