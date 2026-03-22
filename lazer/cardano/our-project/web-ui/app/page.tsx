"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, createClient } from "@evolution-sdk/evolution";
import { OsiPanel } from "./components/osi-panel";
import { SiteHeader } from "./components/site-header";
import type { OsiRow } from "./types";

type WalletApiLike = {
  getUsedAddresses: () => Promise<ReadonlyArray<string>>;
  getUnusedAddresses: () => Promise<ReadonlyArray<string>>;
  getRewardAddresses: () => Promise<ReadonlyArray<string>>;
  getUtxos: () => Promise<ReadonlyArray<string>>;
  signTx: (txCborHex: string, partialSign: boolean) => Promise<string>;
  signData: (addressHex: string, payload: string) => Promise<unknown>;
  submitTx: (txCborHex: string) => Promise<string>;
};

type BrowserWallet = {
  enable: () => Promise<WalletApiLike>;
  isEnabled?: () => Promise<boolean>;
};

declare global {
  interface Window {
    cardano?: Record<string, BrowserWallet>;
  }
}

const shortenAddress = (bech32: string): string =>
  `${bech32.slice(0, 10)}...${bech32.slice(-6)}`;

const getWalletKey = (): string => {
  const wallets = window.cardano;
  if (!wallets) {
    throw new Error(
      "No Cardano wallet found. Install Eternl, Lace, Nami, or another CIP-30 wallet.",
    );
  }

  const preferred = ["eternl", "lace", "nami", "flint"];
  const installed = Object.keys(wallets).filter(
    (key) => typeof wallets[key]?.enable === "function",
  );

  if (installed.length === 0) {
    throw new Error(
      "No compatible CIP-30 wallet was detected in your browser.",
    );
  }

  return preferred.find((wallet) => installed.includes(wallet)) ?? installed[0];
};

const mapUtxoToRow = (utxo: any): OsiRow => {
  const json = utxo.toJSON();
  const txHash = json.transactionId.hash;
  const index = json.index;
  const datumKind = json.datumOption?._tag ?? "None";

  return {
    outRef: `${txHash}#${index}`,
    lovelace: json.assets.lovelace,
    datumKind,
  };
};

export default function HomePage() {
  const validatorAddress = process.env.NEXT_PUBLIC_VALIDATOR_ADDRESS || "";
  const blockfrostBaseUrl =
    process.env.NEXT_PUBLIC_BLOCKFROST_BASE_URL ||
    "https://cardano-preprod.blockfrost.io/api/v0";
  const blockfrostProjectId =
    process.env.NEXT_PUBLIC_BLOCKFROST_PROJECT_ID || "";

  const [osiRows, setOsiRows] = useState<OsiRow[]>([]);
  const [osiStatus, setOsiStatus] = useState("Loading OSIs from chain...");
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedAddressLabel, setConnectedAddressLabel] =
    useState("Connect Wallet");

  const loadOsis = useCallback(async (): Promise<void> => {
    if (!validatorAddress) {
      setOsiRows([]);
      setOsiStatus("Missing NEXT_PUBLIC_VALIDATOR_ADDRESS in .env.local");
      return;
    }

    if (!blockfrostProjectId) {
      setOsiRows([]);
      setOsiStatus("Missing NEXT_PUBLIC_BLOCKFROST_PROJECT_ID in .env.local");
      return;
    }

    try {
      const providerClient = createClient({
        network: "preprod",
        provider: {
          type: "blockfrost",
          baseUrl: blockfrostBaseUrl,
          projectId: blockfrostProjectId,
        },
      });

      const utxos = await providerClient.getUtxos(
        Address.fromBech32(validatorAddress),
      );

      const rows = utxos.map(mapUtxoToRow);
      setOsiRows(rows);
      setOsiStatus(
        rows.length === 0
          ? "No OSIs found at this validator address."
          : `Found ${rows.length} OSI contract UTxO(s).`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load OSIs from chain";
      console.error(message);
      setOsiRows([]);
      setOsiStatus(`Failed to query validator UTxOs: ${message}`);
    }
  }, [blockfrostBaseUrl, blockfrostProjectId, validatorAddress]);

  useEffect(() => {
    void loadOsis();
  }, [loadOsis]);

  const connectButtonLabel = useMemo(() => {
    if (isConnecting) {
      return "Connecting...";
    }

    return connectedAddressLabel;
  }, [connectedAddressLabel, isConnecting]);

  const connectWallet = useCallback(async (): Promise<void> => {
    setIsConnecting(true);

    try {
      const walletKey = getWalletKey();
      const walletApi = await window.cardano![walletKey].enable();

      const client = createClient({
        network: "preprod",
        wallet: { type: "api", api: walletApi as any },
      });

      const address = Address.toBech32(await client.address());
      setIsWalletConnected(true);
      setConnectedAddressLabel(`Connected (${shortenAddress(address)})`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wallet connection failed";
      console.error(message);
      setConnectedAddressLabel("Connect Wallet");
      alert(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  return (
    <div className="page-shell">
      <SiteHeader
        title="Oracle Settled Invoice"
        buttonLabel={connectButtonLabel}
        onConnect={() => {
          void connectWallet();
        }}
        isConnecting={isConnecting}
      />

      <main className="content-area">
        <OsiPanel
          validatorAddress={validatorAddress}
          osiStatus={osiStatus}
          osiRows={osiRows}
          isWalletConnected={isWalletConnected}
        />
      </main>
    </div>
  );
}
