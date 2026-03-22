"use client";

import type { OsiRow } from "../types";

type OsiPanelProps = {
  osiStatus: string;
  osiRows: OsiRow[];
  onFund: () => void;
  onAddFunds: (outRef: string) => void;
  onPayout: (outRef: string) => void;
  canFund: boolean;
  isFunding: boolean;
  isAddingFunds: boolean;
  addingFundsOutRef: string | null;
  isPayingOut: boolean;
  payingOutRef: string | null;
  fundStatus: string | null;
  addFundsStatus: string | null;
  payoutStatus: string | null;
};

export function OsiPanel({
  osiStatus,
  osiRows,
  onFund,
  onAddFunds,
  onPayout,
  canFund,
  isFunding,
  isAddingFunds,
  addingFundsOutRef,
  isPayingOut,
  payingOutRef,
  fundStatus,
  addFundsStatus,
  payoutStatus,
}: Readonly<OsiPanelProps>) {
  const hasRows = osiRows.length > 0;

  return (
    <section className="osi-panel">
      <div className="osi-panel-header">
        <h2 className="section-title">OSIs</h2>
        <button
          id="fund-button"
          className="action-button"
          type="button"
          onClick={onFund}
          disabled={!canFund || isFunding}
        >
          {isFunding ? "Funding..." : "New Fund"}
        </button>
      </div>

      <p className="osi-status">{osiStatus}</p>
      {fundStatus ? <p className="fund-status">{fundStatus}</p> : null}
      {addFundsStatus ? <p className="fund-status">{addFundsStatus}</p> : null}
      {payoutStatus ? <p className="fund-status">{payoutStatus}</p> : null}

      {hasRows && (
        <ul className="osi-list">
          {osiRows.map((row) => (
            <li className="osi-item" key={row.outRef}>
              <div className="osi-item-meta">
                <span className="osi-id">{row.outRef}</span>
                <span className="osi-date">
                  Lovelace: {row.lovelace} | Datum: {row.datumKind}
                </span>
              </div>
              <div className="osi-item-actions">
                <button
                  className="action-button add-funds-button"
                  type="button"
                  onClick={() => {
                    onAddFunds(row.outRef);
                  }}
                  disabled={!canFund || isAddingFunds || isPayingOut}
                >
                  {addingFundsOutRef === row.outRef ? "Adding..." : "Add Funds"}
                </button>
                <button
                  className="action-button payout-button"
                  type="button"
                  onClick={() => {
                    onPayout(row.outRef);
                  }}
                  disabled={!canFund || isPayingOut || isAddingFunds}
                >
                  {payingOutRef === row.outRef ? "Paying..." : "Payout"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
