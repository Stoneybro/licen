// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DataPolicy} from "../src/DataPolicy.sol";

contract DataPolicyTest is Test {
    DataPolicy public policy;

    address public owner = address(1);
    address public requester = address(2);
    address public provider = address(3);
    address public otherRequester = address(4);

    bytes32 public datasetRoot = keccak256("dataset_root");
    bytes32 public datasetRootOpen = keccak256("dataset_root_open");
    bytes32 public manifestHash = keccak256("manifest_hash");
    bytes32 public purposeId = keccak256("NEURAL_RESEARCH");
    bytes32 public disallowedPurposeId = keccak256("COMMERCIAL_R_AND_D");

    function setUp() public {
        policy = new DataPolicy(provider);

        vm.deal(requester, 1_000_000 ether);
        vm.deal(otherRequester, 1_000_000 ether);
    }

    function test_RegisterDataset() public {
        vm.startPrank(owner);

        bytes32[] memory purposes = new bytes32[](1);
        purposes[0] = purposeId;

        address[] memory requesters = new address[](1);
        requesters[0] = requester;

        policy.registerDataset(
            datasetRoot,
            manifestHash,
            10 ether,
            10,
            5,
            3600,
            0,
            true,
            false,
            purposes,
            requesters
        );
        vm.stopPrank();

        (
            bytes32 _datasetRoot,
            address _owner,
            bytes32 _manifestHash,
            uint256 royaltyPerEpoch,
            uint32 maxEpochsPerRun,
            uint32 maxRunsPerRequester,
            uint64 accessTtlSeconds,
            uint64 policyExpiry,
            bool requireResultAttestation,
            bool active,
            bool openRequesters
        ) = policy.policies(datasetRoot);

        assertEq(_datasetRoot, datasetRoot);
        assertEq(_owner, owner);
        assertEq(_manifestHash, manifestHash);
        assertEq(royaltyPerEpoch, 10 ether);
        assertEq(maxEpochsPerRun, 10);
        assertEq(maxRunsPerRequester, 5);
        assertEq(accessTtlSeconds, 3600);
        assertEq(policyExpiry, 0);
        assertTrue(requireResultAttestation);
        assertTrue(active);
        assertFalse(openRequesters);
    }

    function _registerDefaultDataset() internal {
        vm.startPrank(owner);

        bytes32[] memory purposes = new bytes32[](1);
        purposes[0] = purposeId;

        address[] memory requesters = new address[](1);
        requesters[0] = requester;

        policy.registerDataset(
            datasetRoot,
            manifestHash,
            10 ether,
            10,
            5,
            3600,
            0,
            true,
            false,
            purposes,
            requesters
        );
        vm.stopPrank();
    }

    function test_RequestAccess() public {
        _registerDefaultDataset();

        vm.prank(requester);
        bytes32 jobId = policy.requestAccess{value: 50 ether}(datasetRoot, purposeId, 5, manifestHash);

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
        assertEq(jobProvider, provider);
        assertEq(jobPurposeId, purposeId);
        assertEq(requestedEpochs, 5);
        assertEq(escrowAmount, 50 ether);
        assertEq(uint(state), uint(DataPolicy.JobState.Granted));
        assertEq(termsHash, manifestHash);
        assertEq(address(policy).balance, 50 ether);
    }

    function test_RequestAccess_RevertsWhenEscrowAmountIsWrong() public {
        _registerDefaultDataset();

        vm.prank(requester);
        vm.expectRevert("Incorrect escrow amount");
        policy.requestAccess{value: 49 ether}(datasetRoot, purposeId, 5, manifestHash);
    }

    function test_ConfirmTrainingComplete() public {
        _registerDefaultDataset();

        vm.prank(requester);
        bytes32 jobId = policy.requestAccess{value: 60 ether}(datasetRoot, purposeId, 6, manifestHash);

        uint256 ownerInitialBalance = owner.balance;
        uint256 requesterInitialBalance = requester.balance;

        vm.startPrank(provider);
        policy.startJob(jobId);
        policy.confirmTrainingComplete(jobId, 5, keccak256("result"), keccak256("attestation"));
        vm.stopPrank();

        (, , , , , uint256 remainingEscrow, , DataPolicy.JobState state, ) = policy.jobs(jobId);
        assertEq(uint(state), uint(DataPolicy.JobState.Completed));
        assertEq(remainingEscrow, 0);
        assertEq(owner.balance - ownerInitialBalance, 50 ether);
        assertEq(requester.balance - requesterInitialBalance, 10 ether);
        assertEq(address(policy).balance, 0);
    }

    function test_RequestAccess_RevertsWhenExceedingMaxRunsPerRequester() public {
        vm.startPrank(owner);

        bytes32[] memory purposes = new bytes32[](1);
        purposes[0] = purposeId;

        address[] memory requesters = new address[](1);
        requesters[0] = requester;

        policy.registerDataset(
            datasetRoot,
            manifestHash,
            10 ether,
            10,
            1,
            3600,
            0,
            true,
            false,
            purposes,
            requesters
        );
        vm.stopPrank();

        vm.prank(requester);
        policy.requestAccess{value: 10 ether}(datasetRoot, purposeId, 1, manifestHash);

        vm.prank(requester);
        vm.expectRevert("Requester run limit reached");
        policy.requestAccess{value: 10 ether}(datasetRoot, purposeId, 1, manifestHash);
    }

    function test_RequestAccess_RevertsWhenRequesterNotAllowed() public {
        _registerDefaultDataset();

        vm.prank(otherRequester);
        vm.expectRevert("Requester not allowed");
        policy.requestAccess{value: 10 ether}(datasetRoot, purposeId, 1, manifestHash);
    }

    function test_RequestAccess_AllowsOpenRequesterPolicy() public {
        vm.startPrank(owner);

        bytes32[] memory purposes = new bytes32[](1);
        purposes[0] = purposeId;

        policy.registerDataset(
            datasetRootOpen,
            manifestHash,
            10 ether,
            10,
            2,
            3600,
            0,
            false,
            true,
            purposes,
            new address[](0)
        );
        vm.stopPrank();

        vm.prank(otherRequester);
        bytes32 jobId = policy.requestAccess{value: 10 ether}(datasetRootOpen, purposeId, 1, manifestHash);

        (, address jobRequester, , , , , , DataPolicy.JobState state, ) = policy.jobs(jobId);
        assertEq(jobRequester, otherRequester);
        assertEq(uint(state), uint(DataPolicy.JobState.Granted));
    }

    function test_RequestAccess_RevertsWhenPurposeNotAllowed() public {
        _registerDefaultDataset();

        vm.prank(requester);
        vm.expectRevert("Purpose not allowed");
        policy.requestAccess{value: 10 ether}(datasetRoot, disallowedPurposeId, 1, manifestHash);
    }

    function test_RequestAccess_RevertsWhenExceedingMaxEpochsPerRun() public {
        _registerDefaultDataset();

        vm.prank(requester);
        vm.expectRevert("Exceeds max epochs per run");
        policy.requestAccess{value: 110 ether}(datasetRoot, purposeId, 11, manifestHash);
    }

    function test_RequestAccess_RevertsWhenPolicyExpired() public {
        vm.startPrank(owner);

        bytes32[] memory purposes = new bytes32[](1);
        purposes[0] = purposeId;

        address[] memory requesters = new address[](1);
        requesters[0] = requester;

        policy.registerDataset(
            datasetRoot,
            manifestHash,
            10 ether,
            10,
            1,
            3600,
            uint64(block.timestamp + 1),
            true,
            false,
            purposes,
            requesters
        );
        vm.stopPrank();

        vm.warp(block.timestamp + 2);

        vm.prank(requester);
        vm.expectRevert("Policy expired");
        policy.requestAccess{value: 10 ether}(datasetRoot, purposeId, 1, manifestHash);
    }

    function test_ConfirmTrainingComplete_RevertsWhenAttestationRequiredButMissing() public {
        _registerDefaultDataset();

        vm.prank(requester);
        bytes32 jobId = policy.requestAccess{value: 10 ether}(datasetRoot, purposeId, 1, manifestHash);

        vm.startPrank(provider);
        policy.startJob(jobId);
        vm.expectRevert("Attestation required");
        policy.confirmTrainingComplete(jobId, 1, keccak256("result"), bytes32(0));
        vm.stopPrank();
    }

    function test_ConfirmTrainingComplete_RevertsWhenActualEpochsExceedRequested() public {
        _registerDefaultDataset();

        vm.prank(requester);
        bytes32 jobId = policy.requestAccess{value: 10 ether}(datasetRoot, purposeId, 1, manifestHash);

        vm.startPrank(provider);
        policy.startJob(jobId);
        vm.expectRevert("Actual epochs exceed requested");
        policy.confirmTrainingComplete(jobId, 2, keccak256("result"), keccak256("attestation"));
        vm.stopPrank();
    }

    function test_RefundAfterFailure() public {
        _registerDefaultDataset();

        vm.prank(requester);
        bytes32 jobId = policy.requestAccess{value: 20 ether}(datasetRoot, purposeId, 2, manifestHash);

        uint256 requesterInitialBalance = requester.balance;

        vm.prank(provider);
        policy.markJobFailed(jobId, "compute_error");

        vm.prank(requester);
        policy.refund(jobId);

        (, , , , , uint256 remainingEscrow, , DataPolicy.JobState state, ) = policy.jobs(jobId);
        assertEq(uint(state), uint(DataPolicy.JobState.Refunded));
        assertEq(remainingEscrow, 0);
        assertEq(requester.balance - requesterInitialBalance, 20 ether);
        assertEq(address(policy).balance, 0);
    }
}
