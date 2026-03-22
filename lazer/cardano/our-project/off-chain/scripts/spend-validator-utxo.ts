import {
  Address,
  ScriptHash,
  Transaction,
  UTxO,
} from "@evolution-sdk/evolution";
import { getPythScriptHash, getPythState } from "@pythnetwork/pyth-lazer-cardano-js";

import {
  fetchLatestSignedUpdate,
  formatTxHash,
  loadFirstValidatorUtxo,
  loadValidatorUtxoByTxHash,
  logDetailedError,
  loadRuntimeFromEnv,
  makeFeedRedeemer,
  makeWithdrawRedeemer,
  parseCliOutRef,
  readLazerToken,
} from "../e2e.ts";

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
  : await loadFirstValidatorUtxo(
      runtime.client,
      runtime.validator.address,
    );

const pythState = await getPythState(
  runtime.pythPolicyId,
  runtime.providerClient,
);
const pythWithdrawScriptHash = getPythScriptHash(pythState);
const pythUpdate = await fetchLatestSignedUpdate(lazerToken, runtime.feedId);

const now = BigInt(Date.now());
const loggingEvaluator = {
  evaluate: (
    tx: Transaction.Transaction,
    additionalUtxos: ReadonlyArray<UTxO.UTxO> | undefined,
  ) => {
    console.log("Evaluation tx cbor hex:");
    console.log(Transaction.toCBORHex(tx));

    if (additionalUtxos && additionalUtxos.length > 0) {
      console.log("Evaluation additional UTxOs:");
      console.dir(additionalUtxos.map(UTxO.toOutRefString), {
        depth: null,
        colors: true,
      });
    }

    return runtime.providerClient.Effect.evaluateTx(tx);
  },
} as const;

console.log(`Validator address: ${Address.toBech32(runtime.validator.address)}`);
console.log(`Spent validator input: ${UTxO.toOutRefString(validatorUtxo)}`);
console.log(`Pyth state input: ${UTxO.toOutRefString(pythState)}`);
console.log(`Pyth withdraw script hash: ${pythWithdrawScriptHash}`);
console.log(`Feed id: ${runtime.feedId}`);
console.log(`Signed update hex: ${pythUpdate.signedUpdateHex}`);
console.dir({ parsed: pythUpdate.parsed }, { depth: null, colors: true });

try {
  const txHash = await runtime.client
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
      redeemer: makeFeedRedeemer(runtime.feedId),
      label: "osi-accept-pyth",
    })
    .build({
      debug: true,
      evaluator: loggingEvaluator as never,
    })
    .then((built) => built.sign())
    .then((signed) => signed.submit());

  console.log(`Spend tx hash: ${formatTxHash(txHash)}`);
} catch (error) {
  logDetailedError(error);
  throw error;
}
