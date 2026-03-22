"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, createClient } from "@evolution-sdk/evolution";
import { FundModal } from "./components/fund-modal";
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
  const offChainApiBaseUrl =
    process.env.NEXT_PUBLIC_OFF_CHAIN_API_BASE_URL || "http://localhost:8787";

  const [osiRows, setOsiRows] = useState<OsiRow[]>([]);
  const [osiStatus, setOsiStatus] = useState("Loading OSIs from chain...");
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundStatus, setFundStatus] = useState<string | null>(null);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [connectedAddressLabel, setConnectedAddressLabel] =
    useState("Connect Wallet");

  const todayDateString = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

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

  const openFundModal = useCallback(() => {
    setIsFundModalOpen(true);
  }, []);

  const submitFundFromModal = useCallback(
    async (amountInput: string, deadlineInput: string): Promise<void> => {
      if (!/^\d+$/.test(amountInput.trim()) || amountInput.trim() === "0") {
        setFundStatus("Funding failed: amount must be a positive integer.");
        return;
      }

      const deadlineDate = new Date(`${deadlineInput}T23:59:59`);
      const selectedDateOnly = new Date(`${deadlineInput}T00:00:00`);
      const todayDateOnly = new Date(`${todayDateString}T00:00:00`);

      if (Number.isNaN(deadlineDate.getTime())) {
        setFundStatus("Funding failed: invalid deadline format.");
        return;
      }

      if (selectedDateOnly.getTime() < todayDateOnly.getTime()) {
        setFundStatus("Funding failed: deadline cannot be before today.");
        return;
      }

      const fundingLovelace = amountInput.trim();
      const deadline = deadlineDate.getTime().toString();

      setIsFunding(true);
      setIsFundModalOpen(false);
      setFundStatus("Submitting fund transaction...");

      try {
        const response = await fetch(
          `${offChainApiBaseUrl}/api/validator-utxos`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fundingLovelace,
              deadline,
            }),
          },
        );

        const payload = (await response.json()) as
          | { txHash?: string; error?: string }
          | undefined;

        if (!response.ok) {
          throw new Error(payload?.error || "Fund request failed");
        }

        const txHash = payload?.txHash;
        setFundStatus(
          txHash
            ? `Fund created successfully. Tx: ${txHash}`
            : "Fund created successfully.",
        );

        await loadOsis();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create fund";
        setFundStatus(`Funding failed: ${message}`);
      } finally {
        setIsFunding(false);
      }
    },
    [loadOsis, offChainApiBaseUrl, todayDateString],
  );

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
          osiStatus={osiStatus}
          osiRows={osiRows}
          onFund={() => {
            openFundModal();
          }}
          canFund={isWalletConnected}
          isFunding={isFunding}
          fundStatus={fundStatus}
        />
      </main>

      <FundModal
        isOpen={isFundModalOpen}
        minDate={todayDateString}
        isSubmitting={isFunding}
        onClose={() => {
          setIsFundModalOpen(false);
        }}
        onSubmit={(amount, deadline) => {
          void submitFundFromModal(amount, deadline);
        }}
      />
    </div>
  );
}
