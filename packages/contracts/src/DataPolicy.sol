// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

contract DataPolicy {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;

    struct Policy {
        bytes32 datasetRoot;
        address owner;
        bytes32 manifestHash;
        uint256 royaltyPerEpoch;
        uint256 minEscrow;
        uint32 maxEpochsPerRun;
        uint32 maxRunsPerRequester;
        uint64 accessTtlSeconds;
        uint64 policyExpiry;
        bool requireTEE;
        bool requireResultAttestation;
        bool active;
        bool openRequesters; // If true, anyone can request. If false, must be in allowedRequesters
    }

    mapping(bytes32 => Policy) public policies;

    // Arrays/mappings for policy lists
    mapping(bytes32 => mapping(bytes32 => bool)) public allowedPurposeIds;
    mapping(bytes32 => mapping(address => bool)) public allowedRequesters;
    mapping(bytes32 => mapping(address => bool)) public approvedProviders;

    // Job state tracking
    enum JobState { None, Requested, Granted, Running, Completed, Failed, TimedOut, Refunded }

    struct Job {
        bytes32 datasetRoot;
        address requester;
        address provider;
        bytes32 purposeId;
        uint32 requestedEpochs;
        uint256 escrowAmount;
        uint64 requestTime;
        JobState state;
        bytes32 termsHash;
    }

    mapping(bytes32 => Job) public jobs;
    uint256 private jobCounter;

    // Events
    event DatasetRegistered(bytes32 indexed datasetRoot, address indexed owner, bytes32 manifestHash);
    event PolicyActivated(bytes32 indexed datasetRoot);
    event PolicyPaused(bytes32 indexed datasetRoot);
    event PolicyResumed(bytes32 indexed datasetRoot);

    event AccessRequested(bytes32 indexed jobId, bytes32 indexed datasetRoot, address indexed requester, uint32 requestedEpochs);
    event AccessGranted(bytes32 indexed jobId);
    event JobStarted(bytes32 indexed jobId);
    event JobCompleted(bytes32 indexed jobId, uint32 actualEpochs, bytes32 resultHash, bytes32 attestationRef);
    event JobFailed(bytes32 indexed jobId, string reasonCode);
    event JobTimedOut(bytes32 indexed jobId);
    event RoyaltySettled(bytes32 indexed jobId, uint256 amount);
    event RefundIssued(bytes32 indexed jobId, uint256 amount);

    constructor(address _paymentToken) {
        require(_paymentToken != address(0), "Invalid token address");
        paymentToken = IERC20(_paymentToken);
    }

    modifier onlyDatasetOwner(bytes32 datasetRoot) {
        require(policies[datasetRoot].owner == msg.sender, "Not dataset owner");
        _;
    }

    modifier onlyJobRequesterOrOwner(bytes32 jobId) {
        Job memory job = jobs[jobId];
        require(msg.sender == job.requester || msg.sender == policies[job.datasetRoot].owner, "Not authorized for job");
        _;
    }

    function registerDataset(
        bytes32 datasetRoot,
        bytes32 manifestHash,
        uint256 royaltyPerEpoch,
        uint256 minEscrow,
        uint32 maxEpochsPerRun,
        uint32 maxRunsPerRequester,
        uint64 accessTtlSeconds,
        uint64 policyExpiry,
        bool requireTEE,
        bool requireResultAttestation,
        bool openRequesters,
        bytes32[] calldata _allowedPurposeIds,
        address[] calldata _allowedRequesters,
        address[] calldata _approvedProviders
    ) external {
        require(policies[datasetRoot].owner == address(0), "Dataset already registered");

        policies[datasetRoot] = Policy({
            datasetRoot: datasetRoot,
            owner: msg.sender,
            manifestHash: manifestHash,
            royaltyPerEpoch: royaltyPerEpoch,
            minEscrow: minEscrow,
            maxEpochsPerRun: maxEpochsPerRun,
            maxRunsPerRequester: maxRunsPerRequester,
            accessTtlSeconds: accessTtlSeconds,
            policyExpiry: policyExpiry,
            requireTEE: requireTEE,
            requireResultAttestation: requireResultAttestation,
            active: true,
            openRequesters: openRequesters
        });

        for (uint i = 0; i < _allowedPurposeIds.length; i++) {
            allowedPurposeIds[datasetRoot][_allowedPurposeIds[i]] = true;
        }
        for (uint i = 0; i < _allowedRequesters.length; i++) {
            allowedRequesters[datasetRoot][_allowedRequesters[i]] = true;
        }
        for (uint i = 0; i < _approvedProviders.length; i++) {
            approvedProviders[datasetRoot][_approvedProviders[i]] = true;
        }

        emit DatasetRegistered(datasetRoot, msg.sender, manifestHash);
        emit PolicyActivated(datasetRoot);
    }

    function pausePolicy(bytes32 datasetRoot) external onlyDatasetOwner(datasetRoot) {
        require(policies[datasetRoot].active, "Policy already paused");
        policies[datasetRoot].active = false;
        emit PolicyPaused(datasetRoot);
    }

    function resumePolicy(bytes32 datasetRoot) external onlyDatasetOwner(datasetRoot) {
        require(!policies[datasetRoot].active, "Policy already active");
        policies[datasetRoot].active = true;
        emit PolicyResumed(datasetRoot);
    }

    function requestAccess(
        bytes32 datasetRoot,
        bytes32 purposeId,
        address provider,
        uint32 requestedEpochs,
        bytes32 termsHash
    ) external returns (bytes32 jobId) {
        Policy memory policy = policies[datasetRoot];
        require(policy.active, "Policy is not active");
        require(block.timestamp < policy.policyExpiry || policy.policyExpiry == 0, "Policy expired");
        require(termsHash == policy.manifestHash, "Terms hash mismatch");
        require(requestedEpochs <= policy.maxEpochsPerRun, "Exceeds max epochs per run");
        require(allowedPurposeIds[datasetRoot][purposeId], "Purpose not allowed");
        require(approvedProviders[datasetRoot][provider], "Provider not approved");
        
        if (!policy.openRequesters) {
            require(allowedRequesters[datasetRoot][msg.sender], "Requester not allowed");
        }

        uint256 expectedEscrow = policy.royaltyPerEpoch * requestedEpochs;
        if (expectedEscrow < policy.minEscrow) {
            expectedEscrow = policy.minEscrow;
        }

        jobCounter++;
        jobId = keccak256(abi.encodePacked(datasetRoot, msg.sender, jobCounter, block.timestamp));

        jobs[jobId] = Job({
            datasetRoot: datasetRoot,
            requester: msg.sender,
            provider: provider,
            purposeId: purposeId,
            requestedEpochs: requestedEpochs,
            escrowAmount: expectedEscrow,
            requestTime: uint64(block.timestamp),
            state: JobState.Granted,
            termsHash: termsHash
        });

        // Lock escrow
        paymentToken.safeTransferFrom(msg.sender, address(this), expectedEscrow);

        emit AccessRequested(jobId, datasetRoot, msg.sender, requestedEpochs);
        emit AccessGranted(jobId);
    }

    // In a production system, these transitions would be called by the trusted wrapper/orchestrator
    // For MVP, dataset owner or wrapper can update state
    function startJob(bytes32 jobId) external {
        Job storage job = jobs[jobId];
        require(job.state == JobState.Granted, "Invalid state transition");
        require(msg.sender == job.provider || msg.sender == policies[job.datasetRoot].owner, "Unauthorized");

        job.state = JobState.Running;
        emit JobStarted(jobId);
    }

    function confirmTrainingComplete(
        bytes32 jobId,
        uint32 actualEpochs,
        bytes32 resultHash,
        bytes32 attestationRef
    ) external {
        Job storage job = jobs[jobId];
        require(job.state == JobState.Running || job.state == JobState.Granted, "Invalid state transition");
        
        Policy memory policy = policies[job.datasetRoot];
        require(msg.sender == job.provider || msg.sender == policy.owner, "Unauthorized");

        job.state = JobState.Completed;

        // Settlement logic: Settle actual epochs, refund the rest
        uint256 settleAmount = policy.royaltyPerEpoch * actualEpochs;
        
        // Ensure settleAmount respects the minEscrow and doesn't exceed locked escrow
        if (settleAmount < policy.minEscrow) {
            settleAmount = policy.minEscrow;
        }
        if (settleAmount > job.escrowAmount) {
            settleAmount = job.escrowAmount;
        }

        uint256 refundAmount = job.escrowAmount - settleAmount;

        if (settleAmount > 0) {
            paymentToken.safeTransfer(policy.owner, settleAmount);
            emit RoyaltySettled(jobId, settleAmount);
        }

        if (refundAmount > 0) {
            paymentToken.safeTransfer(job.requester, refundAmount);
            emit RefundIssued(jobId, refundAmount);
        }

        emit JobCompleted(jobId, actualEpochs, resultHash, attestationRef);
    }

    function markJobFailed(bytes32 jobId, string calldata reasonCode) external {
        Job storage job = jobs[jobId];
        require(job.state == JobState.Granted || job.state == JobState.Running, "Invalid state transition");
        
        Policy memory policy = policies[job.datasetRoot];
        require(msg.sender == job.provider || msg.sender == policy.owner, "Unauthorized");

        job.state = JobState.Failed;
        emit JobFailed(jobId, reasonCode);
    }

    function timeoutJob(bytes32 jobId) external {
        Job storage job = jobs[jobId];
        require(job.state == JobState.Granted || job.state == JobState.Running, "Invalid state transition");
        
        Policy memory policy = policies[job.datasetRoot];
        require(block.timestamp > job.requestTime + policy.accessTtlSeconds, "TTL not exceeded");

        job.state = JobState.TimedOut;
        emit JobTimedOut(jobId);
    }

    function refund(bytes32 jobId) external {
        Job storage job = jobs[jobId];
        require(job.state == JobState.Failed || job.state == JobState.TimedOut, "Invalid state transition for refund");
        
        uint256 amount = job.escrowAmount;
        require(amount > 0, "No escrow to refund");

        job.escrowAmount = 0; // Prevent double refund
        job.state = JobState.Refunded;

        paymentToken.safeTransfer(job.requester, amount);
        emit RefundIssued(jobId, amount);
    }
}
