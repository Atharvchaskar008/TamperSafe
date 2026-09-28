# IDE & Hands-on Practices

This guide explains how to deploy an **MEP-20 token** (ERC-20 equivalent for MST) using **OpenZeppelin Wizard, Remix IDE, and MetaMask**.

***

### Step 1: Configure Your Token with OpenZeppelin Wizard

1. Open the OpenZeppelin ERC-20 Wizard:\
   👉 <https://wizard.openzeppelin.com/#erc20>
2. Enter your **Token Name** and **Token Symbol**.
   * Example: replace `"MyToken"` with your token name and `"MTK"` with your token symbol.
3. Set the **Premint Amount**.
   * Example: `1_000_000` for an initial supply of 1,000,000 tokens.
4. Click **Open in Remix**.
   * This will generate the smart contract code and open it directly in Remix IDE.

***

### Step 2: Pre-requisites

Before deployment, ensure you have the following:

* **MetaMask browser extension** installed.
* **MST Testnet** network added in MetaMask.
  * Go to [MST Testnet Explorer](https://testnet.mstscan.com/), scroll to the bottom, and click **Add MST Testnet**.
* **tMSTC test funds** in your wallet.
  * Request funds from the [MST Faucet](https://faucet.mstblockchain.com).
* First-time **Remix IDE** users will see an initial setup screen:
  * *AI and Analytics Preferences*: Select **Accept**
  * *How you typically use Remix*: Select **Learning**

***

### Step 3: Understanding Remix IDE

**Remix IDE** is a browser-based development environment for writing, compiling, and deploying smart contracts.\
For MST Blockchain developers, Remix acts as the **bridge** between contract code (Solidity) and the MST Testnet (via MetaMask).

Key Features of Remix:

* **File Explorer**: Manage your Solidity smart contract files.
* **Solidity Compiler**: Compile contracts before deployment.
* **Deploy & Run Transactions**: Deploy contracts to the MST Blockchain using MetaMask.
* **Debugger & Logs**: Analyse contract execution and transaction results.

👉 You do not need to install anything; Remix runs directly in your browser.

***

### Step 4: Deploy Using Remix IDE

1. Open the **Deploy & Run Transactions** tab in the left panel.
2. Connect Remix to MetaMask:
   * Open the **Environment** dropdown.
   * Select **Injected Provider – MetaMask**.
   * If not visible, click **Customise this list**, then under *Deploy using a Browser Extension*, enable **Deploy through the MetaMask browser extension**.
3. In MetaMask, select the **MST Testnet** network. This should be reflected in Remix.
4. Open the **Solidity Compiler** tab and click **Compile Contract**.
5. Return to **Deploy & Run Transactions**.
6. Click **Deploy**.
   * MetaMask will prompt for transaction confirmation.
   * Approve it to deploy the contract on MST Testnet.
7. Once deployment succeeds, the contract will appear in **Deployed Contracts** at the bottom of Remix.
8. Copy the **contract address** from the deployed list for future interaction or verification.

***

### Step 5: Verify Deployment

* Check the **Deployed Contracts** section in Remix.
* Alternatively, paste the contract address in [MST Testnet Explorer](https://testnet.mstscan.com/) to view contract details.

***

**Congratulations!** You have successfully deployed your first **MEP-20 token** on the MST Blockchain using Remix IDE.
