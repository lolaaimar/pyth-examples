import { Address, InlineDatum } from "@evolution-sdk/evolution";

import { formatTxHash, loadRuntimeFromEnv, makeLovelace } from "../e2e.ts";
import {
  makeEmptyOsiDatum,
  makeOsiDatumData,
  makeVerificationKeyCredential,
} from "../osi.ts";

const runtime = await loadRuntimeFromEnv();
const walletAddress = await runtime.client.address();
const validatorAddressBech32 = Address.toBech32(runtime.validator.address);
const defaultDeadline = BigInt(Date.now()) + 24n * 60n * 60n * 1000n;
const datum = makeEmptyOsiDatum(defaultDeadline);
const payees: readonly [string, bigint][] = [
  ["c0359ebb7d0688d79064bd118c99c8b87b5853e3af59245bb97e84d2", 1_000_000_000n],
  ["3f7fc2419347ac70cb5fbcdf3bb8d964727ec1c3e93b364288c22f33", 1_000_000_000n],
  ["28f60a6dcb45d06f76081888b6b749dc8829dcfb5e11596b3775220a", 1_000_000_000n],
  ["5133ea0bdd0b0d7a3461146d5e777e8b2c013929d956032d6d6e91b4", 1_000_000_000n],
  ["05231a2548dc81a3654e857b657960ac892c9e059af3ac4a3ed1d494", 1_000_000_000n],
];
for (const [pubKey, amount] of payees) {
  const credential = makeVerificationKeyCredential(pubKey);
  datum.payees.set(credential, amount);
}
const txHash = await runtime.client
  .newTx()
  .payToAddress({
    address: runtime.validator.address,
    assets: makeLovelace(runtime.fundingLovelace),
    datum: new InlineDatum.InlineDatum({
      data: makeOsiDatumData(datum),
    }),
  })
  .build()
  .then((built) => built.sign())
  .then((signed) => signed.submit());

console.log(`Wallet address: ${Address.toBech32(walletAddress)}`);
console.log(`Validator address: ${validatorAddressBech32}`);
console.log(`Funded lovelace: ${runtime.fundingLovelace.toString()}`);
console.log(`Datum deadline: ${datum.deadline.toString()}`);
console.log(`Create tx hash: ${formatTxHash(txHash)}`);
console.log(
  `Verify with: bun run spend-validator-utxo ${formatTxHash(txHash)}`,
);
