/**
 * Deploys BoxRegistry, TamperSafeEscrow and TelemetryAnchor; wires up
 * roles; registers TS-BOX-01; and writes deployments/<chain>.json plus
 * deployments/abi/*.json -- the only place the relayer and dashboard read
 * contract info from (per CLAUDE.md).
 *
 * Local (M1, this agent runs it):
 *   npx hardhat node                                   # in one terminal
 *   npx hardhat run scripts/deploy.ts --network localhost
 *
 * MST testnet (M6, team-only -- the team runs this, never this agent):
 *   npx hardhat run scripts/deploy.ts --network mst
 *
 *   `hardhat.config.ts`'s `mst` network reads MST_RPC/DEPLOYER_KEY via
 *   `configVariable(...)`, which Hardhat 3 resolves straight from
 *   `process.env` -- there is no dotenv auto-load. Before running, either:
 *     - export MST_RPC=... and DEPLOYER_KEY=0x... in the shell, or
 *     - run `npx hardhat keystore set DEPLOYER_KEY` once (encrypted,
 *       from the hardhat-keystore plugin already in this toolbox) and
 *       just export MST_RPC.
 *   See contracts/.env.example for the variable names and the
 *   mst-contract-deploy skill for the rest of the pre-flight.
 *
 *   This script also needs deployments/accounts.json's `oracleRelayer`
 *   filled in (an address, per M0 -- never a key) before a non-local run:
 *   ORACLE_ROLE has to go to the real relayer wallet, not a Hardhat dev
 *   account.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { artifacts, network } from "hardhat";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// contracts/scripts/deploy.ts -> contracts/ -> repo root
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEPLOYMENTS_DIR = path.join(REPO_ROOT, "deployments");
const ABI_DIR = path.join(DEPLOYMENTS_DIR, "abi");
const ACCOUNTS_PATH = path.join(DEPLOYMENTS_DIR, "accounts.json");

const HARDHAT_LOCAL_CHAIN_ID = 31337n;
const MST_TESTNET_CHAIN_ID = 91562037n;
const MST_MAINNET_CHAIN_ID = 4646n; // off-limits, per CLAUDE.md

const BOX_LABEL = "TS-BOX-01";

async function main() {
  const { ethers } = await network.create();

  const net = await ethers.provider.getNetwork();
  const chainId = net.chainId;

  if (chainId === MST_MAINNET_CHAIN_ID) {
    throw new Error(
      "Refusing to deploy to MST mainnet (chainId 4646). This project is testnet-only, per CLAUDE.md.",
    );
  }

  let outFile: string;
  if (chainId === HARDHAT_LOCAL_CHAIN_ID) {
    outFile = "local.json";
  } else if (chainId === MST_TESTNET_CHAIN_ID) {
    outFile = "mst-testnet.json";
  } else {
    outFile = `chain-${chainId}.json`;
  }

  const isLocal = chainId === HARDHAT_LOCAL_CHAIN_ID;
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // On local, the `mst` network only ever has one configured account (the
  // deployer key), so a second Hardhat dev account stands in for ORACLE_ROLE.
  // Anywhere else, that must be the real relayer wallet -- read its address
  // (never a key) from deployments/accounts.json, filled in at M0.
  let relayerAddress: string;
  if (isLocal) {
    relayerAddress = signers[1].address;
  } else {
    let accounts: { oracleRelayer?: string };
    try {
      accounts = JSON.parse(readFileSync(ACCOUNTS_PATH, "utf8"));
    } catch (error) {
      throw new Error(
        `Could not read ${ACCOUNTS_PATH} to find the relayer/ORACLE address: ${String(error)}`,
      );
    }
    if (accounts.oracleRelayer === undefined || accounts.oracleRelayer === "") {
      throw new Error(
        `deployments/accounts.json's "oracleRelayer" is empty. Fill in the relayer's funded address ` +
          "(per IMPLEMENTATION_PLAN.md M0) before deploying to a non-local network.",
      );
    }
    relayerAddress = accounts.oracleRelayer;
  }

  console.log(`Network chainId=${chainId} -> deployments/${outFile}`);
  console.log(`Deployer: ${deployer.address}`);
  if (isLocal) {
    console.log(
      `ORACLE_ROLE is being granted to ${relayerAddress}, a Hardhat dev account used as a ` +
        "PLACEHOLDER for the real relayer/ORACLE wallet. Do not reuse this address past local testing.",
    );
  } else {
    console.log(
      `ORACLE_ROLE is being granted to ${relayerAddress} (deployments/accounts.json's oracleRelayer). ` +
        "Confirm this is the intended relayer/ORACLE address before proceeding.",
    );
  }

  // --- Deploy ---
  const registry = await ethers.deployContract("BoxRegistry", [deployer.address], deployer);
  await registry.waitForDeployment();
  const registryDeployTx = registry.deploymentTransaction();

  const escrow = await ethers.deployContract(
    "TamperSafeEscrow",
    [deployer.address, await registry.getAddress()],
    deployer,
  );
  await escrow.waitForDeployment();
  const escrowDeployTx = escrow.deploymentTransaction();

  const anchor = await ethers.deployContract("TelemetryAnchor", [deployer.address], deployer);
  await anchor.waitForDeployment();
  const anchorDeployTx = anchor.deploymentTransaction();

  console.log(`BoxRegistry:      ${await registry.getAddress()}`);
  console.log(`TamperSafeEscrow: ${await escrow.getAddress()}`);
  console.log(`TelemetryAnchor:  ${await anchor.getAddress()}`);

  // --- Roles: BINDER_ROLE (escrow), ORACLE_ROLE (escrow + anchor) ---
  const BINDER_ROLE = await registry.BINDER_ROLE();
  const ORACLE_ROLE = await escrow.ORACLE_ROLE();

  await (await registry.connect(deployer).grantRole(BINDER_ROLE, await escrow.getAddress())).wait();
  await (await escrow.connect(deployer).grantRole(ORACLE_ROLE, relayerAddress)).wait();
  await (await anchor.connect(deployer).grantRole(ORACLE_ROLE, relayerAddress)).wait();

  // --- Register TS-BOX-01 ---
  const boxId = ethers.keccak256(ethers.toUtf8Bytes(BOX_LABEL));
  await (await registry.connect(deployer).registerBox(boxId, ethers.ZeroAddress, BOX_LABEL)).wait();

  // --- Write deployments/<chain>.json ---
  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  mkdirSync(ABI_DIR, { recursive: true });

  const deployment = {
    chainId: chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    relayerOracle: {
      address: relayerAddress,
      note: isLocal
        ? "PLACEHOLDER: a Hardhat dev account standing in for the real relayer/ORACLE wallet. " +
          "Replace before any non-local deploy -- never reuse a Hardhat dev key on testnet."
        : "Address granted ORACLE_ROLE on TamperSafeEscrow and TelemetryAnchor for this network.",
    },
    contracts: {
      BoxRegistry: {
        address: await registry.getAddress(),
        deployTxHash: registryDeployTx?.hash ?? null,
      },
      TamperSafeEscrow: {
        address: await escrow.getAddress(),
        deployTxHash: escrowDeployTx?.hash ?? null,
      },
      TelemetryAnchor: {
        address: await anchor.getAddress(),
        deployTxHash: anchorDeployTx?.hash ?? null,
      },
    },
    boxes: [{ label: BOX_LABEL, boxId, deviceKey: ethers.ZeroAddress }],
  };

  const outPath = path.join(DEPLOYMENTS_DIR, outFile);
  writeFileSync(outPath, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);

  // --- ABIs (relayer/dashboard read contract info only from deployments/) ---
  for (const name of ["BoxRegistry", "TamperSafeEscrow", "TelemetryAnchor"] as const) {
    const artifact = await artifacts.readArtifact(name);
    const abiPath = path.join(ABI_DIR, `${name}.json`);
    writeFileSync(abiPath, `${JSON.stringify(artifact.abi, null, 2)}\n`);
    console.log(`Wrote ${abiPath}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
