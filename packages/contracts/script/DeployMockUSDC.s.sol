// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() external returns (MockUSDC usdc) {
        vm.startBroadcast();
        usdc = new MockUSDC();
        vm.stopBroadcast();

        console.log("MockUSDC deployed at:", address(usdc));
        console.log("Add to .env.local:");
        console.log("  PAYMENT_TOKEN_ADDRESS=%s", address(usdc));
    }
}
