/**
 * Deploy contracts to Polygon Amoy:
 * 1) DefaultVerifier (or reuse existing)
 * 2) IdentityRegistry(verifier) (or reuse existing)
 * 3) HealthRegistry(verifier) (or reuse existing)
 * Then links: HealthRegistry.setIdentityRegistry(identity)
 *
 * Usage:
 *   npx hardhat run contracts/scripts/deploy.js --network amoy
 *
 * Optional env to resume/reuse:
 *   EXISTING_VERIFIER_ADDRESS
 *   EXISTING_IDENTITY_REGISTRY_ADDRESS
 *   EXISTING_HEALTH_REGISTRY_ADDRESS
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "POL");

  const startBlock = await hre.ethers.provider.getBlockNumber();

  // 1) DefaultVerifier (or reuse existing)
  let verifierAddress = process.env.EXISTING_VERIFIER_ADDRESS || "";
  let verifierDeployTxHash = "";
  let verifierStartBlock = startBlock;
  if (verifierAddress) {
    console.log("Reusing EXISTING_VERIFIER_ADDRESS:", verifierAddress);
  } else {
    const DefaultVerifier = await hre.ethers.getContractFactory("DefaultVerifier");
    const verifier = await DefaultVerifier.deploy();
    await verifier.waitForDeployment();
    verifierAddress = await verifier.getAddress();
    const deployTx = verifier.deploymentTransaction();
    const receipt = deployTx ? await deployTx.wait() : null;
    verifierDeployTxHash = deployTx?.hash || "";
    verifierStartBlock = receipt?.blockNumber ?? startBlock;
    console.log("DefaultVerifier deployed:", verifierAddress);
    console.log("DefaultVerifier tx:", verifierDeployTxHash);
  }

  // 2) IdentityRegistry(verifier) (or reuse existing)
  let identityRegistryAddress = process.env.EXISTING_IDENTITY_REGISTRY_ADDRESS || "";
  let identityDeployTxHash = "";
  let identityStartBlock = startBlock;
  if (identityRegistryAddress) {
    console.log("Reusing EXISTING_IDENTITY_REGISTRY_ADDRESS:", identityRegistryAddress);
  } else {
    const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
    const identityRegistry = await IdentityRegistry.deploy(verifierAddress);
    await identityRegistry.waitForDeployment();
    identityRegistryAddress = await identityRegistry.getAddress();
    const deployTx = identityRegistry.deploymentTransaction();
    const receipt = deployTx ? await deployTx.wait() : null;
    identityDeployTxHash = deployTx?.hash || "";
    identityStartBlock = receipt?.blockNumber ?? startBlock;
    console.log("IdentityRegistry deployed:", identityRegistryAddress);
    console.log("IdentityRegistry tx:", identityDeployTxHash);
  }

  // 3) HealthRegistry(verifier) (or reuse existing)
  let healthRegistryAddress = process.env.EXISTING_HEALTH_REGISTRY_ADDRESS || "";
  let healthDeployTxHash = "";
  let healthStartBlock = startBlock;
  if (healthRegistryAddress) {
    console.log("Reusing EXISTING_HEALTH_REGISTRY_ADDRESS:", healthRegistryAddress);
  } else {
    const HealthRegistry = await hre.ethers.getContractFactory("HealthRegistry");
    const healthRegistry = await HealthRegistry.deploy(verifierAddress);
    await healthRegistry.waitForDeployment();
    healthRegistryAddress = await healthRegistry.getAddress();
    const deployTx = healthRegistry.deploymentTransaction();
    const receipt = deployTx ? await deployTx.wait() : null;
    healthDeployTxHash = deployTx?.hash || "";
    healthStartBlock = receipt?.blockNumber ?? startBlock;
    console.log("HealthRegistry deployed:", healthRegistryAddress);
    console.log("HealthRegistry tx:", healthDeployTxHash);
  }

  // Link identity registry for guardian veto flow
  const health = await hre.ethers.getContractAt("HealthRegistry", healthRegistryAddress);
  const tx = await health.setIdentityRegistry(identityRegistryAddress);
  const linkReceipt = await tx.wait();
  console.log("HealthRegistry.setIdentityRegistry done");
  console.log("HealthRegistry.setIdentityRegistry tx:", tx.hash);

  const endBlock = await hre.ethers.provider.getBlockNumber();

  console.log("\n--- DEPLOYMENT SUMMARY ---");
  console.log("START_BLOCK=", startBlock);
  console.log("END_BLOCK=", endBlock);
  console.log("NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=", identityRegistryAddress);
  console.log("NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS=", healthRegistryAddress);
  console.log("DEFAULT_VERIFIER_ADDRESS=", verifierAddress);

  const deploymentMeta = {
    network: "polygon-amoy",
    deployer: deployer.address,
    startedAtBlock: startBlock,
    endedAtBlock: endBlock,
    contracts: {
      DefaultVerifier: {
        address: verifierAddress,
        deployTxHash: verifierDeployTxHash,
        startBlock: verifierStartBlock,
      },
      IdentityRegistry: {
        address: identityRegistryAddress,
        deployTxHash: identityDeployTxHash,
        startBlock: identityStartBlock,
      },
      HealthRegistry: {
        address: healthRegistryAddress,
        deployTxHash: healthDeployTxHash,
        startBlock: healthStartBlock,
      },
    },
    links: {
      healthSetIdentityRegistryTxHash: tx.hash,
      healthSetIdentityRegistryBlock: linkReceipt?.blockNumber ?? endBlock,
    },
  };

  const outDir = path.join(process.cwd(), "contracts", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "amoy-latest.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentMeta, null, 2) + "\n", "utf8");
  console.log("Deployment metadata written:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
