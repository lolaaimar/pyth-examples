"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, createClient } from "@evolution-sdk/evolution";
import { AddFundsModal } from "./components/add-funds-modal";
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

type ApiPayload = {
  txHash?: string;
  error?: string;
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
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [addingFundsOutRef, setAddingFundsOutRef] = useState<string | null>(
    null,
  );
  const [isPayingOut, setIsPayingOut] = useState(false);
  const [payingOutRef, setPayingOutRef] = useState<string | null>(null);
  const [fundStatus, setFundStatus] = useState<string | null>(null);
  const [addFundsStatus, setAddFundsStatus] = useState<string | null>(null);
  const [payoutStatus, setPayoutStatus] = useState<string | null>(null);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false);
  const [selectedOutRefForAddFunds, setSelectedOutRefForAddFunds] = useState<
    string | null
  >(null);
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

  const openAddFundsModal = useCallback((outRef: string) => {
    setSelectedOutRefForAddFunds(outRef);
    setIsAddFundsModalOpen(true);
  }, []);

  const parseApiResponse = useCallback(async (response: Response) => {
    const rawText = await response.text();
    let payload: ApiPayload | undefined;

    if (rawText.trim().length > 0) {
      try {
        payload = JSON.parse(rawText) as ApiPayload;
      } catch {
        payload = undefined;
      }
    }

    return { payload, rawText };
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

        const { payload, rawText } = await parseApiResponse(response);

        if (!response.ok) {
          const snippet = rawText.slice(0, 120).replace(/\s+/g, " ");
          throw new Error(
            payload?.error ||
              `Fund request failed (${response.status}). ${snippet}`,
          );
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
    [loadOsis, offChainApiBaseUrl, parseApiResponse, todayDateString],
  );

  const submitAddFundsFromModal = useCallback(
    async (amountInput: string): Promise<void> => {
      if (!selectedOutRefForAddFunds) {
        setAddFundsStatus("Add funds failed: no target UTxO selected.");
        return;
      }

      if (!/^\d+$/.test(amountInput.trim()) || amountInput.trim() === "0") {
        setAddFundsStatus("Add funds failed: amount must be a positive integer.");
        return;
      }

      setIsAddingFunds(true);
      setAddingFundsOutRef(selectedOutRefForAddFunds);
      setIsAddFundsModalOpen(false);
      setAddFundsStatus(`Adding funds to ${selectedOutRefForAddFunds}...`);

      try {
        const response = await fetch(
          `${offChainApiBaseUrl}/api/validator-utxos/add-funds`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              outRef: selectedOutRefForAddFunds,
              additionalFundingLovelace: amountInput.trim(),
            }),
          },
        );

        const { payload, rawText } = await parseApiResponse(response);

        if (!response.ok) {
          const snippet = rawText.slice(0, 120).replace(/\s+/g, " ");
          throw new Error(
            payload?.error ||
              `Add funds request failed (${response.status}). ${snippet}`,
          );
        }

        setAddFundsStatus(
          payload?.txHash
            ? `Funds added. Tx: ${payload.txHash}`
            : "Funds added successfully.",
        );

        await loadOsis();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to add funds";
        setAddFundsStatus(`Add funds failed: ${message}`);
      } finally {
        setIsAddingFunds(false);
        setAddingFundsOutRef(null);
      }
    },
    [loadOsis, offChainApiBaseUrl, parseApiResponse, selectedOutRefForAddFunds],
  );

  const handlePayout = useCallback(
    async (outRef: string): Promise<void> => {
      setIsPayingOut(true);
      setPayingOutRef(outRef);
      setPayoutStatus(`Submitting payout for ${outRef}...`);

      try {
        const response = await fetch(
          `${offChainApiBaseUrl}/api/validator-utxos/spend`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ outRef }),
          },
        );

        const { payload, rawText } = await parseApiResponse(response);

        if (!response.ok) {
          const snippet = rawText.slice(0, 120).replace(/\s+/g, " ");
          throw new Error(
            payload?.error ||
              `Payout request failed (${response.status}). ${snippet}`,
          );
        }

        setPayoutStatus(
          payload?.txHash
            ? `Payout submitted. Tx: ${payload.txHash}`
            : "Payout submitted successfully.",
        );

        await loadOsis();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to submit payout";
        setPayoutStatus(`Payout failed: ${message}`);
      } finally {
        setIsPayingOut(false);
        setPayingOutRef(null);
      }
    },
    [loadOsis, offChainApiBaseUrl, parseApiResponse],
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
          onAddFunds={(outRef) => {
            openAddFundsModal(outRef);
          }}
          onPayout={(outRef) => {
            void handlePayout(outRef);
          }}
          canFund={isWalletConnected}
          isFunding={isFunding}
          isAddingFunds={isAddingFunds}
          addingFundsOutRef={addingFundsOutRef}
          isPayingOut={isPayingOut}
          payingOutRef={payingOutRef}
          fundStatus={fundStatus}
          addFundsStatus={addFundsStatus}
          payoutStatus={payoutStatus}
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

      <AddFundsModal
        isOpen={isAddFundsModalOpen}
        outRef={selectedOutRefForAddFunds}
        isSubmitting={isAddingFunds}
        onClose={() => {
          setIsAddFundsModalOpen(false);
          setSelectedOutRefForAddFunds(null);
        }}
        onSubmit={(amount) => {
          void submitAddFundsFromModal(amount);
        }}
      />
    </div>
  );
}
