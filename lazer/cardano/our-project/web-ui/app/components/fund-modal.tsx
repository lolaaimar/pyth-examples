"use client";

import { useEffect, useMemo, useState } from "react";

type FundModalProps = {
  isOpen: boolean;
  minDate: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (amount: string, deadline: string) => void;
};

export function FundModal({
  isOpen,
  minDate,
  isSubmitting,
  onClose,
  onSubmit,
}: Readonly<FundModalProps>) {
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAmount("");
    setDeadline("");
  }, [isOpen]);

  const canSubmit = useMemo(
    () => amount.trim().length > 0 && deadline.trim().length > 0,
    [amount, deadline],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3 className="modal-title">Create Fund</h3>

        <label className="modal-field" htmlFor="fund-amount">
          <span>Amount (lovelace)</span>
          <input
            id="fund-amount"
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

        <label className="modal-field" htmlFor="fund-deadline">
          <span>Deadline Date</span>
          <input
            id="fund-deadline"
            className="modal-input"
            type="date"
            value={deadline}
            min={minDate}
            onChange={(event) => {
              setDeadline(event.target.value);
            }}
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
              onSubmit(amount, deadline);
            }}
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? "Submitting..." : "Submit Fund"}
          </button>
        </div>
      </div>
    </div>
  );
}
