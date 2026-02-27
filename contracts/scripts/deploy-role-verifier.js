/**
 * Deploy RoleBasedVerifier and switch setVerifier on existing registries.
 *
 * Usage:
 *   npx hardhat run contracts/scripts/deploy-role-verifier.js --network amoy
 *
 * Requires:
 *   - DEPLOYER_PRIVATE_KEY
 *   - NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS
 *   - NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS
 */

const hre = require("hardhat");
require("dotenv").config();
require("dotenv").config({ path: ".env.local", override: true });

async function main() {
  const identityRegistryAddress =
    process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS ||
    process.env.EXISTING_IDENTITY_REGISTRY_ADDRESS ||
    "";
  const healthRegistryAddress =
    process.env.NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS ||
    process.env.EXISTING_HEALTH_REGISTRY_ADDRESS ||
    "";

  if (!identityRegistryAddress || !healthRegistryAddress) {
    throw new Error("Missing NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS or NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS in env.");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Signer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "POL");

  const identity = await hre.ethers.getContractAt("IdentityRegistry", identityRegistryAddress);
  const health = await hre.ethers.getContractAt("HealthRegistry", healthRegistryAddress);

  const [identityOwner, healthOwner, oldIdentityVerifier, oldHealthVerifier] = await Promise.all([
    identity.owner(),
    health.owner(),
    identity.verifier(),
    health.verifier(),
  ]);

  console.log("IdentityRegistry owner:", identityOwner);
  console.log("HealthRegistry owner:", healthOwner);
  console.log("Old Identity verifier:", oldIdentityVerifier);
  console.log("Old Health verifier:", oldHealthVerifier);

  const RoleBasedVerifier = await hre.ethers.getContractFactory("RoleBasedVerifier");
  const verifier = await RoleBasedVerifier.deploy(identityRegistryAddress);
  await verifier.waitForDeployment();
  const roleVerifierAddress = await verifier.getAddress();
  console.log("RoleBasedVerifier deployed:", roleVerifierAddress);

  let switchedHealth = false;
  let switchedIdentity = false;

  if (healthOwner.toLowerCase() === deployer.address.toLowerCase()) {
    const tx = await health.setVerifier(roleVerifierAddress);
    await tx.wait();
    switchedHealth = true;
    console.log("HealthRegistry.setVerifier done");
  } else {
    console.log(
      "SKIP HealthRegistry.setVerifier: signer is not owner. Required owner:",
      healthOwner
    );
  }

  if (identityOwner.toLowerCase() === deployer.address.toLowerCase()) {
    const tx = await identity.setVerifier(roleVerifierAddress);
    await tx.wait();
    switchedIdentity = true;
    console.log("IdentityRegistry.setVerifier done");
  } else {
    console.log(
      "SKIP IdentityRegistry.setVerifier: signer is not owner. Required owner:",
      identityOwner
    );
  }

  const [newIdentityVerifier, newHealthVerifier] = await Promise.all([
    identity.verifier(),
    health.verifier(),
  ]);

  console.log("\n--- RESULT ---");
  console.log("New RoleBasedVerifier:", roleVerifierAddress);
  console.log("IdentityRegistry verifier now:", newIdentityVerifier);
  console.log("HealthRegistry verifier now:", newHealthVerifier);
  console.log("Switched HealthRegistry:", switchedHealth);
  console.log("Switched IdentityRegistry:", switchedIdentity);

  if (!switchedIdentity) {
    console.log("\nACTION REQUIRED:");
    console.log("Run this same script with IdentityRegistry owner wallet/private key to complete full switch.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
