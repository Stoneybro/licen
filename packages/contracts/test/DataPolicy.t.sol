// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DataPolicy} from "../src/DataPolicy.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

// Mock ERC20 for lUSD
contract MockLUSD is ERC20 {
    constructor() ERC20("LICEN USD", "lUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DataPolicyTest is Test {
    DataPolicy public policy;
    MockLUSD public lusd;

    address public owner = address(1);
    address public requester = address(2);
    address public provider = address(3);
    
    bytes32 public datasetRoot = keccak256("dataset_root");
    bytes32 public manifestHash = keccak256("manifest_hash");
    bytes32 public purposeId = keccak256("NEURAL_RESEARCH");

    function setUp() public {
        lusd = new MockLUSD();
        policy = new DataPolicy(address(lusd));

        // Fund requester
        lusd.mint(requester, 1000000 * 10**18);
    }

    function test_RegisterDataset() public {
        vm.startPrank(owner);
        
        bytes32[] memory purposes = new bytes32[](1);
        purposes[0] = purposeId;
        
        address[] memory requesters = new address[](1);
        requesters[0] = requester;
        
        address[] memory providers = new address[](1);
        providers[0] = provider;

        policy.registerDataset(
            datasetRoot,
            manifestHash,
            10 * 10**18, // royaltyPerEpoch: 10 lUSD
            50 * 10**18, // minEscrow: 50 lUSD
            10,          // maxEpochsPerRun
            5,           // maxRunsPerRequester
            3600,        // accessTtlSeconds
            0,           // policyExpiry
            true,        // requireTEE
            true,        // requireResultAttestation
            false,       // openRequesters
            purposes,
            requesters,
            providers
        );
        vm.stopPrank();

        (
            bytes32 _datasetRoot,
            address _owner,
            bytes32 _manifestHash,
            uint256 royaltyPerEpoch,
            uint256 minEscrow,
            uint32 maxEpochsPerRun,
            uint32 maxRunsPerRequester,
            uint64 accessTtlSeconds,
            uint64 policyExpiry,
            bool requireTEE,
            bool requireResultAttestation,
            bool active,
            bool openRequesters
        ) = policy.policies(datasetRoot);

        assertEq(_datasetRoot, datasetRoot);
        assertEq(_owner, owner);
        assertEq(_manifestHash, manifestHash);
        assertEq(royaltyPerEpoch, 10 * 10**18);
        assertTrue(active);
    }

    function _registerDefaultDataset() internal {
        vm.startPrank(owner);
        
        bytes32[] memory purposes = new bytes32[](1);
        purposes[0] = purposeId;
        
        address[] memory requesters = new address[](1);
        requesters[0] = requester;
        
        address[] memory providers = new address[](1);
        providers[0] = provider;

        policy.registerDataset(
            datasetRoot,
            manifestHash,
            10 * 10**18, // 10 lUSD/epoch
            50 * 10**18, // 50 lUSD min
            10,          // max 10 epochs
            5,
            3600,
            0,
            true,
            true,
            false,
            purposes,
            requesters,
            providers
        );
        vm.stopPrank();
    }

    function test_RequestAccess() public {
        _registerDefaultDataset();

        vm.startPrank(requester);
        lusd.approve(address(policy), type(uint256).max);

        // Request 5 epochs (50 lUSD expected, meets minEscrow)
        bytes32 jobId = policy.requestAccess(
            datasetRoot,
            purposeId,
            provider,
            5,
            manifestHash
        );
        vm.stopPrank();

        (
            bytes32 jobDatasetRoot,
            address jobRequester,
            address jobProvider,
            bytes32 jobPurposeId,
            uint32 requestedEpochs,
            uint256 escrowAmount,
            ,
            DataPolicy.JobState state,
            bytes32 termsHash
        ) = policy.jobs(jobId);

        assertEq(jobDatasetRoot, datasetRoot);
        assertEq(jobRequester, requester);
        assertEq(escrowAmount, 50 * 10**18); // 5 * 10 or minEscrow
        assertEq(uint(state), uint(DataPolicy.JobState.Granted));
        assertEq(lusd.balanceOf(address(policy)), 50 * 10**18); // Escrow locked
    }
    
    function test_ConfirmTrainingComplete() public {
        _registerDefaultDataset();

        vm.startPrank(requester);
        lusd.approve(address(policy), type(uint256).max);
        bytes32 jobId = policy.requestAccess(
            datasetRoot,
            purposeId,
            provider,
            6, // 60 lUSD locked
            manifestHash
        );
        vm.stopPrank();
        
        uint256 ownerInitialBalance = lusd.balanceOf(owner);
        uint256 requesterInitialBalance = lusd.balanceOf(requester);

        vm.startPrank(provider);
        policy.startJob(jobId);
        
        // Let's say only 5 epochs actually ran (50 lUSD actual cost)
        policy.confirmTrainingComplete(
            jobId,
            5,
            keccak256("result"),
            keccak256("attestation")
        );
        vm.stopPrank();

        (, , , , , , , DataPolicy.JobState state, ) = policy.jobs(jobId);
        assertEq(uint(state), uint(DataPolicy.JobState.Completed));
        
        // Owner should get 50 lUSD
        assertEq(lusd.balanceOf(owner) - ownerInitialBalance, 50 * 10**18);
        
        // Requester should get 10 lUSD refund (60 locked - 50 settled)
        assertEq(lusd.balanceOf(requester) - requesterInitialBalance, 10 * 10**18);
    }
}
