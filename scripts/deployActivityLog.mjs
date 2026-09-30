import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import { ethers } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.join(__dirname, "..", "contracts");
const sourcePath = path.join(contractsDir, "DogeGameActivityLog.sol");

// Target network: `node scripts/deployActivityLog.mjs dogeos` deploys to DogeOS,
// anything else (default) deploys to 0G. DogeOS requires the Prague EVM target
// and Solidity >= 0.8.30 (install a matching solc, e.g. `npm i -D solc@0.8.30`).
const network = String(process.argv[2] || "0g").toLowerCase() === "dogeos" ? "dogeos" : "0g";
const source = fs.readFileSync(sourcePath, "utf8");

// 1) Compile
const input = {
  language: "Solidity",
  sources: { "DogeGameActivityLog.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    // DogeOS requires Prague; 0G stays on Cancun so the bytecode runs on 0G mainnet.
    evmVersion: network === "dogeos" ? "prague" : "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
  }
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) {
  const fatal = output.errors.filter((e) => e.severity === "error");
  output.errors.forEach((e) => console.log(e.formattedMessage));
  if (fatal.length) process.exit(1);
}
const artifact = output.contracts["DogeGameActivityLog.sol"].DogeGameActivityLog;
const abi = artifact.abi;
const bytecode = "0x" + artifact.evm.bytecode.object;
fs.writeFileSync(path.join(contractsDir, "DogeGameActivityLog.abi.json"), JSON.stringify(abi, null, 2));
console.log("compiled OK — abi written to contracts/DogeGameActivityLog.abi.json");

// 2) Deploy
const rpc = network === "dogeos"
  ? process.env.DOGEOS_RPC_URL || "https://rpc.testnet.dogeos.com/"
  : process.env.ZERO_G_STORAGE_EVM_RPC || process.env.ZERO_G_PAYMENT_RPC_URL || "https://evmrpc.0g.ai";
const key = network === "dogeos"
  ? process.env.DOGEOS_ACTIVITY_PRIVATE_KEY || process.env.ZERO_G_STORAGE_PRIVATE_KEY || process.env.ZERO_G_PRIVATE_KEY
  : process.env.ZERO_G_STORAGE_PRIVATE_KEY || process.env.ZERO_G_PRIVATE_KEY;
const nativeSymbol = network === "dogeos" ? "DOGE" : "0G";
if (!key) { console.error("Missing deployer private key for", network); process.exit(1); }
const provider = new ethers.JsonRpcProvider(rpc);
const wallet = new ethers.Wallet(key, provider);
console.log("deployer:", wallet.address, "| balance:", ethers.formatEther(await provider.getBalance(wallet.address)), nativeSymbol);

const factory = new ethers.ContractFactory(abi, bytecode, wallet);
console.log(`deploying DogeGameActivityLog to ${network === "dogeos" ? "DogeOS" : "0G"}…`);
const contract = await factory.deploy();
const deployTx = contract.deploymentTransaction();
console.log("deploy tx:", deployTx?.hash);
await contract.waitForDeployment();
const address = await contract.getAddress();
console.log("");
console.log("==================================================");
console.log("CONTRACT DEPLOYED");
console.log("address :", address);
console.log("owner   :", wallet.address);
console.log("deploy tx:", deployTx?.hash);
console.log("==================================================");
console.log(`Add to .env:  ${network === "dogeos" ? "DOGEOS" : "ZERO_G"}_ACTIVITY_CONTRACT=` + address);
process.exit(0);
