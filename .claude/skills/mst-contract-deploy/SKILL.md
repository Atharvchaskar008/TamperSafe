---
name: mst-contract-deploy
description: Use when configuring Hardhat or Foundry for MST Blockchain, compiling Solidity for MST, deploying or verifying contracts on MST Testnet, connecting ethers/viem or MetaMask to MST, or debugging MST transaction and gas errors.
---

# Deploying to MST Testnet

## Network facts
- RPC: https://testnetrpc.mstblockchain.com
- chainId: 91562037 (0x5752035)
- Token: tMSTC
- Explorer: https://testnet.mstscan.com (Blockscout)
- Faucet: https://faucet.mstblockchain.com/
- Mainnet (chainId 4646) is off-limits for this project.

## Compiler rule (most common failure)
- Use solc 0.8.24 with evmVersion "cancun". Never use 0.8.25 or later.
- Symptoms of a wrong compiler: InvalidOpcode, EvmVersionMismatch, or gas estimation failing on deploy.

## Config shapes
Hardhat (network entry):
```
solidity: { version: "0.8.24", settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } } }
networks: { mst: { url: process.env.MST_RPC, chainId: 91562037, accounts: [process.env.DEPLOYER_KEY] } }
```
(Hardhat 3 also needs `type: "http"` on the network entry.)

Foundry (`foundry.toml`):
```
solc = "0.8.24"
evm_version = "cancun"
```

## Deploy workflow
1. Pre-flight checks:
   - `.env` exists and is gitignored.
   - The deployer wallet has tMSTC.
   - The pragma is pinned to ^0.8.24.
   - Tests pass on a local node first.
2. Deploy to local (`npx hardhat node`) first, then to `--network mst`.
3. The TEAM runs the deploy command. Do not execute anything that signs with a real key.
4. Record the contract address and the deploy tx hash in `deployments/mst-testnet.json`, then export the ABI for the relayer and frontend.
5. Open the explorer link and confirm the contract exists.
6. Verification (best effort):
   - Try Blockscout at `https://testnet.mstscan.com/api` (e.g. `forge verify-contract ... --verifier blockscout --verifier-url https://testnet.mstscan.com/api/`).
   - If that fails, flatten the contract and verify in the explorer UI.

## Troubleshooting
- Gas or fee errors: use legacy tx type (`--legacy` in Foundry, or `type: 0` / a fixed `gasPrice` in ethers).
- "nonce too low" or stuck transactions: only ONE process may use the relayer key. Serialize sends.
- RPC down or venue internet down: switch the `CHAIN` env var to the local node and demo there. Say so honestly.

## Contract style
- Use OpenZeppelin (Ownable/AccessControl, ReentrancyGuard, ERC20/721).
- Use custom errors, and emit an event for every state change the dashboard shows.
- Follow checks-effects-interactions. Write escrow tests for the happy path, refund/timeout, and unauthorized callers.
