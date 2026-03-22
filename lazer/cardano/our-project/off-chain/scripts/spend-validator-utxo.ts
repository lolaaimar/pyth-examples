import {
  Address,
  Data,
  Effect,
  ScriptHash,
  Transaction,
  UTxO,
} from "@evolution-sdk/evolution";
import {
  getPythScriptHash,
  getPythState,
} from "@pythnetwork/pyth-lazer-cardano-js";

import {
  fetchLatestSignedUpdate,
  formatTxHash,
  loadFirstValidatorUtxo,
  loadValidatorUtxoByTxHash,
  logDetailedError,
  loadRuntimeFromEnv,
  makeWithdrawRedeemer,
  parseCliOutRef,
  readLazerToken,
  makeLovelace,
} from "../e2e.ts";
import {
  decodeOsiDatumData,
  makePayoutRedeemerData,
  paymentCredentialToAddress,
  type OsiDatum,
} from "../osi.ts";
import type { ParsedFeedPayload } from "@pythnetwork/pyth-lazer-sdk";

const runtime = await loadRuntimeFromEnv();
const lazerToken = readLazerToken();
const targetOutRef = parseCliOutRef(process.argv[2]);
const validatorUtxo = targetOutRef
  ? await loadValidatorUtxoByTxHash(
      runtime.client,
      runtime.validator.address,
      targetOutRef.transactionIdHex,
      targetOutRef.index,
    )
  : await loadFirstValidatorUtxo(runtime.client, runtime.validator.address);

const pythState = await getPythState(
  runtime.pythPolicyId,
  runtime.providerClient,
);
const pythWithdrawScriptHash = getPythScriptHash(pythState);
const pythUpdate = await fetchLatestSignedUpdate(lazerToken, runtime.queryFeedIds);
const osiDatum = decodeValidatorDatum(validatorUtxo);
const paymentOutputs = buildPaymentOutputs(runtime.network, osiDatum, pythUpdate.parsed);

const now = BigInt(Date.now());
const loggingEvaluator = {
  evaluate: (
    tx: Transaction.Transaction,
    additionalUtxos: ReadonlyArray<UTxO.UTxO> | undefined,
  ) =>
    Effect.gen(function* () {
      console.log("Evaluation tx cbor hex:");
      console.log(Transaction.toCBORHex(tx));

      if (additionalUtxos && additionalUtxos.length > 0) {
        console.log("Evaluation additional UTxOs:");
        console.dir(additionalUtxos.map(UTxO.toOutRefString), {
          depth: null,
          colors: true,
        });
      }

      return yield* runtime.providerClient.Effect.evaluateTx(tx);
    }),
} as const;

console.log(
  `Validator address: ${Address.toBech32(runtime.validator.address)}`,
);
console.log(`Spent validator input: ${UTxO.toOutRefString(validatorUtxo)}`);
console.log(`Pyth state input: ${UTxO.toOutRefString(pythState)}`);
console.log(`Pyth withdraw script hash: ${pythWithdrawScriptHash}`);
console.log(`Primary feed id: ${runtime.feedId}`);
console.log(`Query feed ids: ${runtime.queryFeedIds.join(", ")}`);
console.log(`Signed update hex: ${pythUpdate.signedUpdateHex}`);
console.dir({ parsed: pythUpdate.parsed }, { depth: null, colors: true });
console.dir(
  {
    paymentOutputs: paymentOutputs.map(({ address, lovelace }) => ({
      address: Address.toBech32(address),
      lovelace: lovelace.toString(),
    })),
  },
  { depth: null, colors: true },
);

try {
  let builder = runtime.client
    .newTx()
    .setValidity({
      from: now - 60_000n,
      to: now + 60_000n,
    })
    .readFrom({
      referenceInputs: [pythState],
    })
    .withdraw({
      amount: 0n,
      redeemer: makeWithdrawRedeemer(pythUpdate.signedUpdate),
      stakeCredential: ScriptHash.fromHex(pythWithdrawScriptHash),
      label: "pyth-withdraw",
    })
    .attachScript({
      script: runtime.validator.script,
    })
    .collectFrom({
      inputs: [validatorUtxo],
      redeemer: makePayoutRedeemerData(),
      label: "osi-payout",
    });

  let totalPaymentLvc = 0n;
  for (const payment of paymentOutputs) {
    builder = builder.payToAddress({
      address: payment.address,
      assets: makeLovelace(payment.lovelace),
    });

    totalPaymentLvc += payment.lovelace;
  }

  if (totalPaymentLvc < validatorUtxo.assets.lovelace) {
    builder = builder.payToAddress({
      address: validatorUtxo.address,
      assets: makeLovelace(validatorUtxo.assets.lovelace - totalPaymentLvc),
      datum: validatorUtxo.datumOption
    });
  }

  const txHash = await builder
    .build({
      evaluator: loggingEvaluator as never,
    })
    .then((built) => built.sign())
    .then((signed) => signed.submit());

  console.log(`Spend tx hash: ${formatTxHash(txHash)}`);
} catch (error) {
  logDetailedError(error);
  throw error;
}

function decodeValidatorDatum(validatorUtxo: UTxO.UTxO): OsiDatum {
  const datumOption = validatorUtxo.datumOption;

  if (!datumOption || datumOption._tag !== "InlineDatum") {
    throw new Error("Validator UTxO is missing an inline OSI datum");
  }

  return decodeOsiDatumData(datumOption.data as Data.Constr);
}

function buildPaymentOutputs(
  network: "mainnet" | "preprod" | "preview",
  datum: OsiDatum,
  parsedUpdate: typeof pythUpdate.parsed,
): { address: Address.Address; lovelace: bigint }[] {
  if (!parsedUpdate) {
    throw new Error("Pyth update is missing parsed feed data");
  }

  const quoteFeed = findFeed(parsedUpdate.priceFeeds, 16);
  const baseFeed = findFeed(parsedUpdate.priceFeeds, 8);
  const networkId = network === "mainnet" ? 1 : 0;

  return Array.from(datum.payees, ([paymentCredential, quoteAmount]) => ({
    address: paymentCredentialToAddress(paymentCredential, networkId),
    lovelace: computeLovelacePayout(quoteAmount, quoteFeed, baseFeed),
  }));
}

function findFeed(
  feeds: readonly ParsedFeedPayload[],
  priceFeedId: number,
): ParsedFeedPayload {
  const feed = feeds.find((candidate) => candidate.priceFeedId === priceFeedId);

  if (!feed) {
    throw new Error(`Missing parsed Pyth feed ${priceFeedId}`);
  }

  if (feed.price === undefined || feed.exponent === undefined) {
    throw new Error(`Parsed Pyth feed ${priceFeedId} is missing price data`);
  }

  return feed;
}

function computeLovelacePayout(
  quoteAmount: bigint,
  quoteFeed: ParsedFeedPayload,
  baseFeed: ParsedFeedPayload,
): bigint {
  const quotePrice = BigInt(quoteFeed.price!);
  const basePrice = BigInt(baseFeed.price!);
  const quoteExponent = quoteFeed.exponent!;
  const baseExponent = baseFeed.exponent!;

  if (basePrice <= 0n || quotePrice <= 0n) {
    throw new Error("Pyth prices must be positive for payout calculation");
  }

  if (quoteExponent >= baseExponent) {
    const scale = 10n ** BigInt(quoteExponent - baseExponent);
    return (quoteAmount * quotePrice * scale) / basePrice;
  }

  const scale = 10n ** BigInt(baseExponent - quoteExponent);
  return (quoteAmount * quotePrice) / (basePrice * scale);
}
