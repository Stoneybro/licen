import {
  DataPolicy,
  DataPolicy_DatasetRegistered,
  DataPolicy_PolicyActivated,
  DataPolicy_PolicyPaused,
  DataPolicy_PolicyResumed,
  DataPolicy_AccessRequested,
  DataPolicy_AccessGranted,
  DataPolicy_JobStarted,
  DataPolicy_JobCompleted,
  DataPolicy_JobFailed,
  DataPolicy_JobTimedOut,
  DataPolicy_RoyaltySettled,
  DataPolicy_RefundIssued,
} from "generated";

DataPolicy.DatasetRegistered.handler(async ({ event, context }) => {
  context.Dataset.set({
    id: event.params.datasetRoot,
    owner: event.params.owner,
    manifestHash: event.params.manifestHash,
    active: false, // Wait for PolicyActivated
    timestamp: BigInt(event.block.timestamp),
    txHash: event.transaction.hash,
  });

  context.EventLog.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    datasetRoot: event.params.datasetRoot,
    jobId: null,
    eventType: "DatasetRegistered",
    timestamp: BigInt(event.block.timestamp),
    txHash: event.transaction.hash,
    details: JSON.stringify({ owner: event.params.owner, manifestHash: event.params.manifestHash })
  });
});

DataPolicy.PolicyActivated.handler(async ({ event, context }) => {
  let dataset = await context.Dataset.get(event.params.datasetRoot);
  if (dataset) {
    context.Dataset.set({
      ...dataset,
      active: true,
    });
  }
  
  context.EventLog.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    datasetRoot: event.params.datasetRoot,
    jobId: null,
    eventType: "PolicyActivated",
    timestamp: BigInt(event.block.timestamp),
    txHash: event.transaction.hash,
    details: null
  });
});

DataPolicy.PolicyPaused.handler(async ({ event, context }) => {
  let dataset = await context.Dataset.get(event.params.datasetRoot);
  if (dataset) {
    context.Dataset.set({
      ...dataset,
      active: false,
    });
  }
});

DataPolicy.PolicyResumed.handler(async ({ event, context }) => {
  let dataset = await context.Dataset.get(event.params.datasetRoot);
  if (dataset) {
    context.Dataset.set({
      ...dataset,
      active: true,
    });
  }
});

DataPolicy.AccessRequested.handler(async ({ event, context }) => {
  context.Job.set({
    id: event.params.jobId,
    dataset_id: event.params.datasetRoot, // Foreign key created by @derivedFrom
    datasetRoot: event.params.datasetRoot,
    requester: event.params.requester,
    requestedEpochs: Number(event.params.requestedEpochs),
    state: "Requested",
    timestamp: BigInt(event.block.timestamp),
    txHash: event.transaction.hash,
    lastUpdatedTimestamp: BigInt(event.block.timestamp),
    actualEpochs: null,
    resultHash: null,
    attestationRef: null,
    failReason: null,
    royaltySettled: null,
    refundIssued: null,
  });

  context.EventLog.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    datasetRoot: event.params.datasetRoot,
    jobId: event.params.jobId,
    eventType: "AccessRequested",
    timestamp: BigInt(event.block.timestamp),
    txHash: event.transaction.hash,
    details: JSON.stringify({ requester: event.params.requester, epochs: Number(event.params.requestedEpochs) })
  });
});

DataPolicy.AccessGranted.handler(async ({ event, context }) => {
  let job = await context.Job.get(event.params.jobId);
  if (job) {
    context.Job.set({
      ...job,
      state: "Granted",
      lastUpdatedTimestamp: BigInt(event.block.timestamp),
    });
  }
  
  context.EventLog.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    datasetRoot: job ? job.datasetRoot : null,
    jobId: event.params.jobId,
    eventType: "AccessGranted",
    timestamp: BigInt(event.block.timestamp),
    txHash: event.transaction.hash,
    details: null
  });
});

DataPolicy.JobStarted.handler(async ({ event, context }) => {
  let job = await context.Job.get(event.params.jobId);
  if (job) {
    context.Job.set({
      ...job,
      state: "Running",
      lastUpdatedTimestamp: BigInt(event.block.timestamp),
    });
  }
});

DataPolicy.JobCompleted.handler(async ({ event, context }) => {
  let job = await context.Job.get(event.params.jobId);
  if (job) {
    context.Job.set({
      ...job,
      state: "Completed",
      actualEpochs: Number(event.params.actualEpochs),
      resultHash: event.params.resultHash,
      attestationRef: event.params.attestationRef,
      lastUpdatedTimestamp: BigInt(event.block.timestamp),
    });
  }
});

DataPolicy.JobFailed.handler(async ({ event, context }) => {
  let job = await context.Job.get(event.params.jobId);
  if (job) {
    context.Job.set({
      ...job,
      state: "Failed",
      failReason: event.params.reasonCode,
      lastUpdatedTimestamp: BigInt(event.block.timestamp),
    });
  }
});

DataPolicy.JobTimedOut.handler(async ({ event, context }) => {
  let job = await context.Job.get(event.params.jobId);
  if (job) {
    context.Job.set({
      ...job,
      state: "TimedOut",
      lastUpdatedTimestamp: BigInt(event.block.timestamp),
    });
  }
});

DataPolicy.RoyaltySettled.handler(async ({ event, context }) => {
  let job = await context.Job.get(event.params.jobId);
  if (job) {
    context.Job.set({
      ...job,
      royaltySettled: event.params.amount,
      lastUpdatedTimestamp: BigInt(event.block.timestamp),
    });
  }
});

DataPolicy.RefundIssued.handler(async ({ event, context }) => {
  let job = await context.Job.get(event.params.jobId);
  if (job) {
    context.Job.set({
      ...job,
      state: "Refunded", // Wait, is Refunded a distinct terminal state in schema? Yes. But job might already be Failed or TimedOut. Let's keep it as is.
      refundIssued: event.params.amount,
      lastUpdatedTimestamp: BigInt(event.block.timestamp),
    });
  }
});
