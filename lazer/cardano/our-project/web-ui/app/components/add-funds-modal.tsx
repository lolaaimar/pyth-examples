"use client";

import { useEffect, useMemo, useState } from "react";

type AddFundsModalProps = {
  isOpen: boolean;
  outRef: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (amount: string) => void;
};

export function AddFundsModal({
  isOpen,
  outRef,
  isSubmitting,
  onClose,
  onSubmit,
}: Readonly<AddFundsModalProps>) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAmount("");
  }, [isOpen]);

  const canSubmit = useMemo(() => amount.trim().length > 0, [amount]);

  if (!isOpen || !outRef) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3 className="modal-title">Add Funds</h3>
        <p className="modal-message">Target UTxO</p>
        <p className="modal-outref">{outRef}</p>

        <label className="modal-field" htmlFor="add-funds-amount">
          <span>Amount (lovelace)</span>
          <input
            id="add-funds-amount"
            className="modal-input"
            inputMode="numeric"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value.replace(/\D/g, ""));
            }}
            placeholder="2000000"
            disabled={isSubmitting}
          />
        </label>

        <div className="modal-actions">
          <button
            type="button"
            className="modal-cancel-button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="action-button"
            onClick={() => {
              onSubmit(amount);
            }}
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? "Adding..." : "Add Funds"}
          </button>
        </div>
      </div>
    </div>
  );
}
