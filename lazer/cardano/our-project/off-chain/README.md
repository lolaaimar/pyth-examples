# off-chain

To install dependencies:

```bash
bun install
```

Minimal e2e commands:

```bash
bun run create-validator-utxo
bun run spend-validator-utxo <createTxHash>
bun run evaluate-ogmios <txCborHex>
bun run fetch-ada-usdt-update
```

You can also pass an explicit out-ref as `<createTxHash>#<index>`.

Required environment variables:

- `NETWORK` = `preprod`, `preview`, or `mainnet`
- `WALLET_MNEMONIC`
- `PYTH_POLICY_ID`
- `LAZER_TOKEN`
- `VALIDATOR_LOVELACE` (defaults to `5000000`)
- provider config:
  - `PROVIDER_TYPE=blockfrost` with `BLOCKFROST_BASE_URL` and `BLOCKFROST_PROJECT_ID`
  - or `PROVIDER_TYPE=kupmios` with `KUPO_URL` and `OGMIOS_URL`
  - or `PROVIDER_TYPE=maestro` with `MAESTRO_BASE_URL` and `MAESTRO_API_KEY`
  - or `PROVIDER_TYPE=koios` with `KOIOS_BASE_URL` and optional `KOIOS_TOKEN`
