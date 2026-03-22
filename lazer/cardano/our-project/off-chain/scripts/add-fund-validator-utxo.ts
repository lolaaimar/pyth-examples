import { addFundValidatorUtxo } from "../services/add-fund-validator-utxo.ts";

// Parse CLI arguments
const additionalFundingLovelace = BigInt(process.argv[2] ?? "0");
const outRef = process.argv[3];

if (!process.argv[2] || additionalFundingLovelace === 0n) {
  throw new Error(
    "Expected additional funding lovelace as first CLI argument (e.g., bun run add-fund-validator-utxo 2000000)",
  );
}

const result = await addFundValidatorUtxo({
  additionalFundingLovelace,
  outRef,
});

console.log(`Wallet address: ${result.walletAddressBech32}`);
console.log(`Validator address: ${result.validatorAddressBech32}`);
console.log(`Spent validator input: ${result.spentOutRef}`);
console.log(`Previous validator lovelace: ${result.previousValidatorLovelace}`);
console.log(`Added lovelace: ${result.addedLovelace}`);
console.log(`New validator lovelace: ${result.newValidatorLovelace}`);
console.log(`Fund tx hash: ${result.txHash}`);
console.log(`Verify with: bun run spend-validator-utxo ${result.txHash}`);
