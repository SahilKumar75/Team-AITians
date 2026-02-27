/**
 * Deploy IdentityRegistry and HealthRegistry to Polygon Amoy.
 *
 * Prerequisites:
 *   - DEPLOYER_PRIVATE_KEY in env (wallet with test POL on Amoy)
 *   - Optional: POLYGON_RPC_URL (default: https://rpc-amoy.polygon.technology)
 *
 * Usage:
 *   npx hardhat run contracts/scripts/deploy.ts --network amoy
 *
 * After deploy, set in .env / production:
 *   NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=<IdentityRegistry address>
 *   NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS=<HealthRegistry address>
 */

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "POL");

  // 1. Deploy DefaultVerifier (or reuse existing one to resume failed deploys)
  let verifierAddress = process.env.EXISTING_VERIFIER_ADDRESS || "";
  if (verifierAddress) {
    console.log("Reusing EXISTING_VERIFIER_ADDRESS:", verifierAddress);
  } else {
    const DefaultVerifier = await ethers.getContractFactory("DefaultVerifier");
    const verifier = await DefaultVerifier.deploy();
    await verifier.waitForDeployment();
    verifierAddress = await verifier.getAddress();
    console.log("DefaultVerifier deployed to:", verifierAddress);
  }

  // 2. Deploy IdentityRegistry(verifier)
  let identityRegistryAddress = process.env.EXISTING_IDENTITY_REGISTRY_ADDRESS || "";
  if (identityRegistryAddress) {
    console.log("Reusing EXISTING_IDENTITY_REGISTRY_ADDRESS:", identityRegistryAddress);
  } else {
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identityRegistry = await IdentityRegistry.deploy(verifierAddress);
    await identityRegistry.waitForDeployment();
    identityRegistryAddress = await identityRegistry.getAddress();
    console.log("IdentityRegistry deployed to:", identityRegistryAddress);
  }

  // 3. Deploy HealthRegistry(verifier)
  let healthRegistryAddress = process.env.EXISTING_HEALTH_REGISTRY_ADDRESS || "";
  if (healthRegistryAddress) {
    console.log("Reusing EXISTING_HEALTH_REGISTRY_ADDRESS:", healthRegistryAddress);
  } else {
    const HealthRegistry = await ethers.getContractFactory("HealthRegistry");
    const healthRegistry = await HealthRegistry.deploy(verifierAddress);
    await healthRegistry.waitForDeployment();
    healthRegistryAddress = await healthRegistry.getAddress();
    console.log("HealthRegistry deployed to:", healthRegistryAddress);
  }

  // 4. Link IdentityRegistry into HealthRegistry (for guardian veto on Unconscious Protocol)
  const health = await ethers.getContractAt("HealthRegistry", healthRegistryAddress);
  await health.setIdentityRegistry(identityRegistryAddress);
  console.log("HealthRegistry.setIdentityRegistry(", identityRegistryAddress, ") done");

  console.log("\n--- Add these to your .env (and production) ---\n");
  console.log("NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=" + identityRegistryAddress);
  console.log("NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS=" + healthRegistryAddress);
  console.log("\nVerifier (admin can call verify(doctorOrHospitalAddress)): " + verifierAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
