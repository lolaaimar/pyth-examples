import cors from "cors";
import express from "express";

import { addFundValidatorUtxo } from "./services/add-fund-validator-utxo.ts";
import { createValidatorUtxo } from "./services/create-validator-utxo.ts";

const app = express();
const port = Number(process.env.OFF_CHAIN_API_PORT ?? "8787");
const allowedOrigin = process.env.WEB_UI_ORIGIN ?? "http://localhost:3000";

app.use(express.json());
app.use(
  cors({
    origin: allowedOrigin,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/validator-utxos", async (req, res) => {
  try {
    const fundingLovelaceRaw = req.body?.fundingLovelace;
    const deadlineRaw = req.body?.deadline;

    const fundingLovelace =
      fundingLovelaceRaw === undefined ? undefined : BigInt(fundingLovelaceRaw);
    const deadline =
      deadlineRaw === undefined ? undefined : BigInt(deadlineRaw);

    const result = await createValidatorUtxo({
      fundingLovelace,
      deadline,
    });
    res.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create validator UTxO";
    res.status(500).json({ error: message });
  }
});

app.post("/api/validator-utxos/add-funds", async (req, res) => {
  try {
    const outRef =
      typeof req.body?.outRef === "string" ? req.body.outRef : undefined;
    const additionalFundingRaw = req.body?.additionalFundingLovelace;

    if (additionalFundingRaw === undefined) {
      res.status(400).json({ error: "Missing additionalFundingLovelace" });
      return;
    }

    const result = await addFundValidatorUtxo({
      additionalFundingLovelace: BigInt(additionalFundingRaw),
      outRef,
    });

    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to add funds to validator UTxO";
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`off-chain api listening on http://localhost:${port}`);
});
