"use client";

import type { OsiRow } from "../types";

type OsiPanelProps = {
  osiStatus: string;
  osiRows: OsiRow[];
  onFund: () => void;
  canFund: boolean;
  isFunding: boolean;
  fundStatus: string | null;
};

export function OsiPanel({
  osiStatus,
  osiRows,
  onFund,
  canFund,
  isFunding,
  fundStatus,
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
                disabled={!canFund}
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
