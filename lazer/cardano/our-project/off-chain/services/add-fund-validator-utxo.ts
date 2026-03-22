import { Address, Data, InlineDatum, UTxO } from "@evolution-sdk/evolution";

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

export type AddFundValidatorUtxoInput = {
  additionalFundingLovelace: bigint;
  outRef?: string;
};

export type AddFundValidatorUtxoResult = {
  txHash: string;
  walletAddressBech32: string;
  validatorAddressBech32: string;
  spentOutRef: string;
  previousValidatorLovelace: string;
  addedLovelace: string;
  newValidatorLovelace: string;
};

export async function addFundValidatorUtxo(
  input: AddFundValidatorUtxoInput,
): Promise<AddFundValidatorUtxoResult> {
  if (input.additionalFundingLovelace <= 0n) {
    throw new Error("additionalFundingLovelace must be greater than zero");
  }

  const runtime = await loadRuntimeFromEnv();
  const targetOutRef = parseCliOutRef(input.outRef);

  const validatorUtxo = targetOutRef
    ? await loadValidatorUtxoByTxHash(
        runtime.client,
        runtime.validator.address,
        targetOutRef.transactionIdHex,
        targetOutRef.index,
      )
    : await loadFirstValidatorUtxo(runtime.client, runtime.validator.address);

  const osiDatum = decodeValidatorDatum(validatorUtxo);
  const walletAddress = await runtime.client.address();
  const currentValidatorLovelace = validatorUtxo.assets.lovelace;
  const newValidatorLovelace =
    currentValidatorLovelace + input.additionalFundingLovelace;

  const txHash = await runtime.client
    .newTx()
    .attachScript({
      script: runtime.validator.script,
    })
    .collectFrom({
      inputs: [validatorUtxo],
      redeemer: makeFundRedeemerData(),
      label: "osi-fund",
    })
    .payToAddress({
      address: runtime.validator.address,
      assets: makeLovelace(newValidatorLovelace),
      datum: new InlineDatum.InlineDatum({
        data: makeOsiDatumData(osiDatum),
      }),
    })
    .build()
    .then((built) => built.sign())
    .then((signed) => signed.submit());

  return {
    txHash: formatTxHash(txHash),
    walletAddressBech32: Address.toBech32(walletAddress),
    validatorAddressBech32: Address.toBech32(runtime.validator.address),
    spentOutRef: UTxO.toOutRefString(validatorUtxo),
    previousValidatorLovelace: currentValidatorLovelace.toString(),
    addedLovelace: input.additionalFundingLovelace.toString(),
    newValidatorLovelace: newValidatorLovelace.toString(),
  };
}

function decodeValidatorDatum(validatorUtxo: UTxO.UTxO) {
  const datumOption = validatorUtxo.datumOption;

  if (!datumOption || datumOption._tag !== "InlineDatum") {
    throw new Error("Validator UTxO is missing an inline OSI datum");
  }

  return decodeOsiDatumData(datumOption.data as Data.Constr);
}
