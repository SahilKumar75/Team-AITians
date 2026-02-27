import { ethers, Signer } from "ethers";

const DEFAULT_MIN_UPLOAD_GAS_BALANCE = ethers.parseEther(
  process.env.NEXT_PUBLIC_MIN_UPLOAD_GAS_BALANCE_POL || "0.05"
);

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
  signer: Signer,
  opts?: { minRequiredPol?: string }
): Promise<{ address: string; before: bigint; after: bigint; toppedUp: boolean }> {
  const provider = signer.provider;
  if (!provider) {
    throw new Error("Wallet provider unavailable for balance check.");
  }

  let minRequired = DEFAULT_MIN_UPLOAD_GAS_BALANCE;
  if (opts?.minRequiredPol) {
    try {
      minRequired = ethers.parseEther(opts.minRequiredPol);
    } catch {
      minRequired = DEFAULT_MIN_UPLOAD_GAS_BALANCE;
    }
  }

  const address = await signer.getAddress();
  const before = await provider.getBalance(address);
  if (before >= minRequired) {
    return { address, before, after: before, toppedUp: false };
  }

  const fundRes = await fetch("/api/auth/fund-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      minRequired: ethers.formatEther(minRequired),
      purpose: "upload",
    }),
  });

  const fundJson = (await fundRes.json().catch(() => ({}))) as FundWalletResponse;
  if (!fundRes.ok || fundJson.error) {
    throw new Error(
      fundJson.error ||
      `Low gas in ${address} (${ethers.formatEther(before)} POL) and sponsor funding failed.`
    );
  }

  const after = await provider.getBalance(address);
  if (after < minRequired) {
    throw new Error(
      `Low gas in signer ${address}. Current balance ${ethers.formatEther(
        after
      )} POL is below required ${ethers.formatEther(minRequired)} POL.`
    );
  }

  return { address, before, after, toppedUp: true };
}
