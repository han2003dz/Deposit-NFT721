import React from "react";

export function Deposit({ depositTokens, tokenSymbol }) {
  return (
    <div>
      <h4>Deposit</h4>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.target);
          const amount = formData.get("amount");

          if (amount) {
            depositTokens(amount);
          }
        }}
      >
        <div className="form-group">
          <label>Amount of {tokenSymbol}</label>
          <input
            className="form-control"
            type="number"
            step="1"
            name="amount"
            placeholder="1"
            required
          />
        </div>
        <div className="form-group">
          <input className="btn btn-primary" type="submit" value="Deposit" />
        </div>
      </form>
    </div>
  );
}
