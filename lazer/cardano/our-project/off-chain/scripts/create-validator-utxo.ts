import { createValidatorUtxo } from "../services/create-validator-utxo.ts";

const result = await createValidatorUtxo();

console.log(`Wallet address: ${result.walletAddressBech32}`);
console.log(`Validator address: ${result.validatorAddressBech32}`);
console.log(`Funded lovelace: ${result.fundedLovelace}`);
console.log(`Datum deadline: ${result.deadline}`);
console.log(`Create tx hash: ${result.txHash}`);
console.log(`Verify with: bun run spend-validator-utxo ${result.txHash}`);
