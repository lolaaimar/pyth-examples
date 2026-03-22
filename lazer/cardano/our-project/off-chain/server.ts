import cors from "cors";
import express from "express";

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

app.listen(port, () => {
  console.log(`off-chain api listening on http://localhost:${port}`);
});
