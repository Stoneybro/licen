"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { ethers } = require("ethers");
const _0g_compute_ts_sdk_1 = require("@0gfoundation/0g-compute-ts-sdk");
async function main() {
    console.log("Checking 0G Compute Network testnet providers...");
    const rpcUrl = "https://evmrpc-testnet.0g.ai";
    console.log("RPC:", rpcUrl);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    // Just a random private key for discovery
    const wallet = new ethers.Wallet("0x1234567890123456789012345678901234567890123456789012345678901234", provider);
    const broker = await (0, _0g_compute_ts_sdk_1.createZGComputeNetworkBroker)(wallet);
    console.log("Fetching fine-tuning services...");
    try {
        const services = await broker.fineTuning.listService();
        console.log("All services:", JSON.stringify(services, null, 2));
        const available = services.filter((s) => s.available === true || s.Available === true);
        console.log("Available services:", JSON.stringify(available, null, 2));
    }
    catch (err) {
        console.error("Error listing services:", err);
    }
}
main().catch(console.error);
