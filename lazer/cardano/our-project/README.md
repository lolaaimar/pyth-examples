# OSI: Oracle-Settled Invoice

Oracle-Settled Invoice is a Cardano escrow that locks one asset and settles a liability indexed to another using Pyth prices.

## Quick Start

### 1. Build contracts

```bash
cd on-chain
aiken build -t verbose -f all
```

### 2. Install off-chain deps

```bash
cd off-chain
bun install
```

### 3. Set environment variables

Create a `.env` file in the `off-chain` directory with the following variables:

- `LAZER_TOKEN` - The asset name of the Lazer token that provides access to Pyth.
- `WALLET_MNEMONIC` - The mnemonic phrase for the wallet that will be used to interact with the contracts. This wallet should have some ADA on the preprod network.
- `PYTH_POLICY_ID` - The policy ID of the Pyth on the Cardano preprod network.
- `BLOCKFROST_BASE_URL` - The base URL for the Blockfrost API. For preprod, this is `https://cardano-preprod.blockfrost.io/api/v0`.
- `BLOCKFROST_PROJECT_ID` - Your Blockfrost project ID for the preprod network.
- `BASE_CURRENCY` - The number of decimal places for the base currency (e.g., 8 for USDT).
