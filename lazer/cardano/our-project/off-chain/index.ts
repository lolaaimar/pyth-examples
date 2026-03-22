import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import dotenv from "dotenv";

dotenv.config();

const lazerToken = process.env.LAZER_TOKEN;

if (!lazerToken) {
  throw new Error("LAZER_TOKEN is not set in environment");
}

const lazer = await PythLazerClient.create({
  token: lazerToken,
  logger: console, // Optionally log operations (to the console in this case.)
  webSocketPoolConfig: {
    numConnections: 1, // Optionally specify number of parallel redundant connections to reduce the chance of dropped messages. The connections will round-robin across the provided URLs. Default is 4.
    onError: (error) => {
      console.error("⛔️ WebSocket error:", error.message);
    },
    // Optional configuration for resilient WebSocket connections
    rwsConfig: {
      heartbeatTimeoutDurationMs: 5000, // Optional heartbeat timeout duration in milliseconds
      maxRetryDelayMs: 1000, // Optional maximum retry delay in milliseconds
      logAfterRetryCount: 10, // Optional log after how many retries
    },
  },
});

const latestPrice = await lazer.getLatestPrice({
  channel: "fixed_rate@200ms",
  formats: ["solana"],
  jsonBinaryEncoding: "hex",
  priceFeedIds: [16],
  properties: ["price", "exponent"],
});

if (!latestPrice.solana?.data) {
  throw new Error("Missing update payload");
}

console.log("Latest price update:", latestPrice.solana.data);

const update = Buffer.from(latestPrice.solana.data, "hex");
console.log("Decoded update:", update);
