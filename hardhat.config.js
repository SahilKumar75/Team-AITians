require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("dotenv").config({ path: ".env.local", override: true });

const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    amoy: {
      url: process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: DEPLOYER_PRIVATE_KEY.startsWith("0x") ? [DEPLOYER_PRIVATE_KEY] : [`0x${DEPLOYER_PRIVATE_KEY}`],
    },
  },
};
