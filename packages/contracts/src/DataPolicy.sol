// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract DataPolicy is ReentrancyGuard {
    address public immutable backendWallet;

    struct Policy {
        bytes32 datasetRoot;
        address owner;
        bytes32 manifestHash;
        uint256 royaltyPerEpoch;
        uint32 maxEpochsPerRun;
        uint32 maxRunsPerRequester;
        uint64 accessTtlSeconds;
        uint64 policyExpiry;
        bool requireResultAttestation;
        bool active;
        bool openRequesters; // If true, anyone can request. If false, must be in allowedRequesters
    }

    mapping(bytes32 => Policy) public policies;

    // Arrays/mappings for policy lists
    mapping(bytes32 => mapping(bytes32 => bool)) public allowedPurposeIds;
    mapping(bytes32 => mapping(address => bool)) public allowedRequesters;
    mapping(bytes32 => mapping(address => uint32)) public requesterRunCounts;

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

    constructor(address _backendWallet) {
        require(_backendWallet != address(0), "Invalid backend wallet address");
        backendWallet = _backendWallet;
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

    modifier onlyBackend() {
        require(msg.sender == backendWallet, "Not backend wallet");
        _;
    }

    function registerDataset(
        bytes32 datasetRoot,
        bytes32 manifestHash,
        uint256 royaltyPerEpoch,
        uint32 maxEpochsPerRun,
        uint32 maxRunsPerRequester,
        uint64 accessTtlSeconds,
        uint64 policyExpiry,
        bool requireResultAttestation,
        bool openRequesters,
        bytes32[] calldata _allowedPurposeIds,
        address[] calldata _allowedRequesters
    ) external {
        require(policies[datasetRoot].owner == address(0), "Dataset already registered");

        policies[datasetRoot] = Policy({
            datasetRoot: datasetRoot,
            owner: msg.sender,
            manifestHash: manifestHash,
            royaltyPerEpoch: royaltyPerEpoch,
            maxEpochsPerRun: maxEpochsPerRun,
            maxRunsPerRequester: maxRunsPerRequester,
            accessTtlSeconds: accessTtlSeconds,
            policyExpiry: policyExpiry,
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
        uint32 requestedEpochs,
        bytes32 termsHash
    ) external payable nonReentrant returns (bytes32 jobId) {
        Policy memory policy = policies[datasetRoot];
        require(policy.active, "Policy is not active");
        require(block.timestamp < policy.policyExpiry || policy.policyExpiry == 0, "Policy expired");
        require(termsHash == policy.manifestHash, "Terms hash mismatch");
        require(requestedEpochs <= policy.maxEpochsPerRun, "Exceeds max epochs per run");
        require(requesterRunCounts[datasetRoot][msg.sender] < policy.maxRunsPerRequester, "Requester run limit reached");
        require(allowedPurposeIds[datasetRoot][purposeId], "Purpose not allowed");
        
        if (!policy.openRequesters) {
            require(allowedRequesters[datasetRoot][msg.sender], "Requester not allowed");
        }

        uint256 requiredEscrow = policy.royaltyPerEpoch * requestedEpochs;
        require(msg.value == requiredEscrow, "Incorrect escrow amount");
        requesterRunCounts[datasetRoot][msg.sender] += 1;

        jobCounter++;
        jobId = keccak256(abi.encodePacked(datasetRoot, msg.sender, jobCounter, block.timestamp));

        jobs[jobId] = Job({
            datasetRoot: datasetRoot,
            requester: msg.sender,
            provider: backendWallet,
            purposeId: purposeId,
            requestedEpochs: requestedEpochs,
            escrowAmount: requiredEscrow,
            requestTime: uint64(block.timestamp),
            state: JobState.Granted,
            termsHash: termsHash
        });

        emit AccessRequested(jobId, datasetRoot, msg.sender, requestedEpochs);
        emit AccessGranted(jobId);
    }

    function startJob(bytes32 jobId) external onlyBackend {
        Job storage job = jobs[jobId];
        require(job.state == JobState.Granted, "Invalid state transition");

        job.state = JobState.Running;
        emit JobStarted(jobId);
    }

    function confirmTrainingComplete(
        bytes32 jobId,
        uint32 actualEpochs,
        bytes32 resultHash,
        bytes32 attestationRef
    ) external onlyBackend nonReentrant {
        Job storage job = jobs[jobId];
        require(job.state == JobState.Running || job.state == JobState.Granted, "Invalid state transition");
        
        Policy memory policy = policies[job.datasetRoot];
        require(actualEpochs <= job.requestedEpochs, "Actual epochs exceed requested");
        if (policy.requireResultAttestation) {
            require(attestationRef != bytes32(0), "Attestation required");
        }

        job.state = JobState.Completed;

        // Settlement logic: Settle actual epochs, refund the rest
        uint256 settleAmount = policy.royaltyPerEpoch * actualEpochs;
        if (settleAmount > job.escrowAmount) {
            settleAmount = job.escrowAmount;
        }

        uint256 refundAmount = job.escrowAmount - settleAmount;
        job.escrowAmount = 0;

        if (settleAmount > 0) {
            _sendValue(policy.owner, settleAmount);
            emit RoyaltySettled(jobId, settleAmount);
        }

        if (refundAmount > 0) {
            _sendValue(job.requester, refundAmount);
            emit RefundIssued(jobId, refundAmount);
        }

        emit JobCompleted(jobId, actualEpochs, resultHash, attestationRef);
    }

    function markJobFailed(bytes32 jobId, string calldata reasonCode) external onlyBackend {
        Job storage job = jobs[jobId];
        require(job.state == JobState.Granted || job.state == JobState.Running, "Invalid state transition");

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

    function refund(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.state == JobState.Failed || job.state == JobState.TimedOut, "Invalid state transition for refund");
        
        uint256 amount = job.escrowAmount;
        require(amount > 0, "No escrow to refund");

        job.escrowAmount = 0; // Prevent double refund
        job.state = JobState.Refunded;

        _sendValue(job.requester, amount);
        emit RefundIssued(jobId, amount);
    }

    function _sendValue(address recipient, uint256 amount) internal {
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "Native transfer failed");
    }
}
