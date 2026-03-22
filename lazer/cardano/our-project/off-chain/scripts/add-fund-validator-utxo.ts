import {
  Address,
  Data,
  InlineDatum,
  UTxO,
} from "@evolution-sdk/evolution";

import {
  formatTxHash,
  loadFirstValidatorUtxo,
  loadRuntimeFromEnv,
  loadValidatorUtxoByTxHash,
  makeLovelace,
  parseCliOutRef,
} from "../e2e.ts";
import {
  decodeOsiDatumData,
  makeFundRedeemerData,
  makeOsiDatumData,
} from "../osi.ts";

const runtime = await loadRuntimeFromEnv();

// Parse CLI arguments
const additionalFundingLovelace = BigInt(process.argv[2] ?? "0");
const targetOutRef = parseCliOutRef(process.argv[3]);

if (!process.argv[2] || additionalFundingLovelace === 0n) {
  throw new Error(
    "Expected additional funding lovelace as first CLI argument (e.g., bun run add-fund-validator-utxo 2000000)"
  );
}

// Load the validator UTxO
let validatorUtxo: UTxO.UTxO;
if (targetOutRef) {
  validatorUtxo = await loadValidatorUtxoByTxHash(
    runtime.client,
    runtime.validator.address,
    targetOutRef.transactionIdHex,
    targetOutRef.index,
  );
} else {
  validatorUtxo = await loadFirstValidatorUtxo(
    runtime.client,
    runtime.validator.address,
  );
}

// Extract and decode the existing datum
let osiDatum;
try {
  osiDatum = decodeValidatorDatum(validatorUtxo);
} catch (error) {
  throw new Error(`Failed to decode validator datum: ${error}`);
}

const walletAddress = await runtime.client.address();
const currentValidatorLovelace = validatorUtxo.assets.lovelace;
const newValidatorLovelace = currentValidatorLovelace + additionalFundingLovelace;

try {
  // Build the transaction
  const builder = runtime.client
    .newTx()
    .attachScript({
      script: runtime.validator.script,
    })
    .collectFrom({
      inputs: [validatorUtxo],
      redeemer: makeFundRedeemerData(),
      label: "osi-fund",
    })
    // Return the combined funds to the validator with the same datum
    .payToAddress({
      address: runtime.validator.address,
      assets: makeLovelace(newValidatorLovelace),
      datum: new InlineDatum.InlineDatum({
        data: makeOsiDatumData(osiDatum),
      }),
    });

  const txHash = await builder
    .build()
    .then((built) => built.sign())
    .then((signed: any) => signed.submit());

  // Log transaction details
  console.log(`Wallet address: ${Address.toBech32(walletAddress)}`);
  console.log(`Validator address: ${Address.toBech32(runtime.validator.address)}`);
  console.log(`Spent validator input: ${UTxO.toOutRefString(validatorUtxo)}`);
  console.log(
    `Previous validator lovelace: ${currentValidatorLovelace.toString()}`
  );
  console.log(`Added lovelace: ${additionalFundingLovelace.toString()}`);
  console.log(
    `New validator lovelace: ${newValidatorLovelace.toString()}`
  );
  console.log(`Fund tx hash: ${formatTxHash(txHash)}`);
  console.log(`Verify with: bun run spend-validator-utxo ${formatTxHash(txHash)}`);
} catch (error) {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error("Unknown error occurred");
  }
  throw error;
}

function decodeValidatorDatum(validatorUtxo: UTxO.UTxO) {
  const datumOption = validatorUtxo.datumOption;

  if (!datumOption || datumOption._tag !== "InlineDatum") {
    throw new Error("Validator UTxO is missing an inline OSI datum");
  }

  return decodeOsiDatumData(datumOption.data as Data.Constr);
}
