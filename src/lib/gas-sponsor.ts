import { ethers, Signer } from "ethers";

const MIN_UPLOAD_GAS_BALANCE = ethers.parseEther("0.015");

type FundWalletResponse = {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  txHash?: string;
  funded?: string;
  error?: string;
};

/**
 * Ensures the current signer has enough gas balance for a multi-step upload tx flow.
 * If low, asks server sponsor endpoint to top up the same wallet.
 */
export async function ensureUploadGasBalance(
  signer: Signer
): Promise<{ address: string; before: bigint; after: bigint; toppedUp: boolean }> {
  const provider = signer.provider;
  if (!provider) {
    throw new Error("Wallet provider unavailable for balance check.");
  }

  const address = await signer.getAddress();
  const before = await provider.getBalance(address);
  if (before >= MIN_UPLOAD_GAS_BALANCE) {
    return { address, before, after: before, toppedUp: false };
  }

  const fundRes = await fetch("/api/auth/fund-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, minRequired: "0.015" }),
  });

  const fundJson = (await fundRes.json().catch(() => ({}))) as FundWalletResponse;
  if (!fundRes.ok || fundJson.error) {
    throw new Error(
      fundJson.error ||
      `Low gas in ${address} (${ethers.formatEther(before)} POL) and sponsor funding failed.`
    );
  }

  const after = await provider.getBalance(address);
  if (after < MIN_UPLOAD_GAS_BALANCE) {
    throw new Error(
      `Low gas in signer ${address}. Current balance ${ethers.formatEther(
        after
      )} POL is below required ${ethers.formatEther(MIN_UPLOAD_GAS_BALANCE)} POL.`
    );
  }

  return { address, before, after, toppedUp: true };
}

