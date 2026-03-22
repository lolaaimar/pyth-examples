import {
  Address,
  Data,
  InlineDatum,
} from "@evolution-sdk/evolution";

import {
  formatTxHash,
  loadRuntimeFromEnv,
  makeLovelace,
} from "../e2e.ts";

const runtime = await loadRuntimeFromEnv();
const walletAddress = await runtime.client.address();
const validatorAddressBech32 = Address.toBech32(runtime.validator.address);

const txHash = await runtime.client
  .newTx()
  .payToAddress({
    address: runtime.validator.address,
    assets: makeLovelace(runtime.fundingLovelace),
    datum: new InlineDatum.InlineDatum({
      data: Data.constr(0n, []),
    }),
  })
  .build()
  .then((built) => built.sign())
  .then((signed) => signed.submit());

console.log(`Wallet address: ${Address.toBech32(walletAddress)}`);
console.log(`Validator address: ${validatorAddressBech32}`);
console.log(`Funded lovelace: ${runtime.fundingLovelace.toString()}`);
console.log(`Create tx hash: ${formatTxHash(txHash)}`);
console.log(`Verify with: bun run spend-validator-utxo ${formatTxHash(txHash)}`);
