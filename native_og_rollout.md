# Native 0G Rollout Runbook

This project now uses native 0G for researcher escrow, publisher settlement, and researcher refunds.

## What changed

- `DataPolicy.requestAccess(...)` is now `payable`.
- Researchers send native 0G as `msg.value`.
- Publisher payouts and researcher refunds are native transfers.
- The web app no longer uses ERC-20 `approve` / `allowance`.
- Balance and pricing UI now uses `0G` and 18-decimal formatting.
- The deploy path no longer needs `PAYMENT_TOKEN_ADDRESS`.

## Local checklist

### 1. Deploy a fresh `DataPolicy`

The old contract address is not compatible with the native-0G flow.

Run from `packages/contracts`:

```bash
BACKEND_WALLET_ADDRESS=<backend_wallet_address> \
forge script script/DeployDataPolicy.s.sol:DeployDataPolicy \
  --rpc-url "$OG_EVM_RPC_URL" \
  --broadcast
```

Save the deployed contract address.

### 2. Update web env

Set this in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_OG_DATA_POLICY_ADDRESS=<new_data_policy_address>
NEXT_PUBLIC_OG_EVM_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_ENVIO_GRAPHQL_URL=http://127.0.0.1:8080/v1/graphql
```

Keep your existing web env for Privy, DB, and storage.

### 3. Update orchestrator env

Set this in `packages/orchestrator/.env`:

```bash
OG_DATA_POLICY_ADDRESS=<new_data_policy_address>
OG_EVM_RPC_URL=https://evmrpc-testnet.0g.ai
ENVIO_GRAPHQL_URL=http://127.0.0.1:8080/v1/graphql
```

Also make sure these are present and funded:

```bash
ORCHESTRATOR_PRIVATE_KEY=<...>
BACKEND_WALLET_PRIVATE_KEY=<...>
OG_COMPUTE_PRIVATE_KEY=<...>
DATABASE_URL=<...>
LICEN_WEB_API_URL=http://localhost:3000
```

Notes:

- `BACKEND_WALLET_PRIVATE_KEY` must control the same address used as `BACKEND_WALLET_ADDRESS` during deployment.
- The backend wallet must hold native 0G for gas because it sends `startJob` and `confirmTrainingComplete`.
- `OG_COMPUTE_PRIVATE_KEY` must also hold native 0G if your compute flow spends it.

### 4. Update indexer contract address

Edit [packages/indexer/config.yaml](/home/dev/licen/packages/indexer/config.yaml:12):

- replace `contracts[0].address`
- optionally set `start_block` to the deployment block of the new contract instead of `0`

This is required because the indexer config is currently file-based and still points at the old deployment.

### 5. Fund researcher wallets with native 0G

The request flow no longer mints test USDC. Researchers must hold enough native 0G to cover:

- escrow value
- transaction gas

### 6. Start the stack

From repo root:

```bash
pnpm dev:stack
```

That starts:

- indexer
- Next.js app
- orchestrator

### 7. Smoke test locally

1. Publish a dataset.
2. Confirm the dataset appears in marketplace and publisher views with the manifest title/description.
3. Request access from a different wallet.
4. Confirm the wallet balance drops by `escrow + gas`.
5. Confirm the policy contract balance increases by the escrow amount.
6. Let orchestrator pick up the job.
7. Confirm `confirmTrainingComplete` pays the publisher and refunds any remainder.
8. Confirm Envio surfaces `AccessRequested`, `RoyaltySettled`, and `RefundIssued` as expected.

## Production checklist

### 1. Treat this as a fresh contract deployment

Do not reuse the old ERC-20-based deployment. Native-value and token escrow are different economic models.

### 2. Deploy the new contract

Deploy `DataPolicy` with the production backend wallet address.

Record:

- contract address
- deployment block
- deploy tx hash

### 3. Roll config in this order

1. Update indexer `config.yaml` with the new address and deployment block.
2. Restart/redeploy the indexer.
3. Update orchestrator `OG_DATA_POLICY_ADDRESS`.
4. Update web `NEXT_PUBLIC_OG_DATA_POLICY_ADDRESS`.
5. Restart/redeploy orchestrator and web.

Reason:

- If web points at the new contract before indexer/orchestrator do, the UI can create jobs that other services are not following yet.

### 4. Fund operational wallets

Fund:

- backend wallet
- compute wallet

with enough native 0G for sustained operations.

### 5. Validate production before opening traffic

Run one end-to-end training request with controlled wallets and verify:

- researcher escrow is locked in native 0G
- publisher receives payout
- refund is returned when actual epochs are lower than requested
- indexer records the new events under the new contract address
- dashboard/session amounts display in `0G`

## Code-level notes

- Contract tests: `forge test`
- Web type-check: `pnpm --filter web exec tsc --noEmit --pretty false`
- Orchestrator type-check: `pnpm --filter orchestrator exec tsc --noEmit --pretty false`

## Known follow-up

The indexer address is still configured directly in `packages/indexer/config.yaml`. A good next improvement is to generate that file from an env-backed template so contract cutovers do not require manual edits.
