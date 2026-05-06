import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { ethers } = require("ethers") as typeof import("ethers");
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";

async function main() {
  try {
    const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY || "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const rpcUrl = "https://evmrpc-testnet.0g.ai";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`, provider);

    console.log("Initializing broker...");
    const broker = await createZGComputeNetworkBroker(wallet as any);
    
    console.log("Fetching fine-tuning services from testnet...");
    const services = await (broker as any).fineTuning.listService();
    
    console.log(`Found ${services.length} providers.`);
    const available = services.filter((s: any) => s.available === true || s.Available === true);
    console.log(`Available providers: ${available.length}`);
    
    console.dir(services, { depth: null });
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
