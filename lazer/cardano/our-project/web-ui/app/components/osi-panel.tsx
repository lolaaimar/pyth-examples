"use client";

import type { OsiRow } from "../types";

type OsiPanelProps = {
  validatorAddress: string;
  osiStatus: string;
  osiRows: OsiRow[];
  isWalletConnected: boolean;
};

export function OsiPanel({
  validatorAddress,
  osiStatus,
  osiRows,
  isWalletConnected,
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
          disabled={!isWalletConnected}
        >
          New Fund
        </button>
      </div>

      <p className="osi-status">{osiStatus}</p>

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
              <button
                className="action-button payout-button"
                type="button"
                disabled={!isWalletConnected}
              >
                Payout
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
