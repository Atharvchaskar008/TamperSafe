import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

// Compiler pinned per CLAUDE.md / the mst-contract-deploy skill:
// solc 0.8.24 exactly, evmVersion "cancun". Never bump past 0.8.24 here.
export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    // In-process EDR chain used by `npx hardhat test` (Hardhat dev accounts,
    // auto-funded). This is the default network for the test suite.
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    // `npx hardhat node` spawns a JSON-RPC node on 127.0.0.1:8545 seeded with
    // the same Hardhat dev accounts. scripts/deploy.ts targets this for M1.
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    // MST Testnet — M6, team-only. Never targeted by this agent: no key is
    // read here (configVariable defers to the team's own .env at deploy
    // time), and `--network mst` is never invoked by this agent.
    mst: {
      type: "http",
      chainType: "l1",
      url: configVariable("MST_RPC"),
      chainId: 91562037,
      accounts: [configVariable("DEPLOYER_KEY")],
    },
  },
});
