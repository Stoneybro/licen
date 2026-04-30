// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {DataPolicy} from "../src/DataPolicy.sol";

contract DeployDataPolicy is Script {
    function run() external returns (DataPolicy policy) {
        address paymentToken = vm.envAddress("PAYMENT_TOKEN_ADDRESS");
        address backendWallet = vm.envAddress("BACKEND_WALLET_ADDRESS");

        vm.startBroadcast();
        policy = new DataPolicy(paymentToken, backendWallet);
        vm.stopBroadcast();

        console.log("DataPolicy deployed at:", address(policy));
        console.log("Add to .env.local:");
        console.log("  NEXT_PUBLIC_OG_DATA_POLICY_ADDRESS=%s", address(policy));
    }
}
