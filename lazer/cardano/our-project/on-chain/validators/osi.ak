use aiken/collection/list
use aiken/collection/pairs
use aiken/option
use cardano/address.{PaymentCredential, Script}
use cardano/assets.{AssetName, PolicyId}
use cardano/transaction.{
  Output, OutputReference, Transaction, find_script_outputs,
}
use pyth.{PriceUpdate, get_updates}
use types.{Fund, OsiDatum, OsiRedeemers, Payout}

fn expected_quote_amount(
  base_amount: Int,
  price: Int,
  exponent: Int,
  base_currency: Int,
) -> Int {
  todo
}

fn expected_for_credential(
  payees: Pairs<PaymentCredential, Int>,
  payee_cred: PaymentCredential,
  price: Int,
  exponent: Int,
  base_currency: Int,
) -> Option<Int> {
  pairs.get_first(payees, payee_cred)
    |> option.map(
        fn(base_amount) {
          expected_quote_amount(base_amount, price, exponent, base_currency)
        },
      )
}

/// Oracle-settled Invoice
validator oracleSettled(base_currency: Int, pyth_policy: PolicyId) {
  spend(
    datum: Option<OsiDatum>,
    redeemer: OsiRedeemers,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    let Transaction { inputs, outputs, .. } = tx

    when redeemer is {
      Fund -> {
        let in = inputs |> transaction.resolve_input(utxo)
        expect Script(script_hash) = in.address.payment_credential
        expect [out] = find_script_outputs(outputs, script_hash)
        assets.match(in.value, out.value, <=)
      }

      Payout -> {
        expect Some(datum) = datum
        let OsiDatum { timestamp, payees, quote_token } = datum

        expect [feed1, feed2] = get_updates(pyth_policy, tx)

        trace feed1
        trace feed2

        // REVIEW
        // list.all(
        //   outputs,
        //   fn(out) {
        //     let actual =
        //       assets.quantity_of(
        //         out.value,
        //         quote_token.policy_id,
        //         quote_token.asset_name,
        //       )
        //     let payee_cred = out.address.payment_credential
        //     when
        //       expected_for_credential(
        //         payees,
        //         payee_cred,
        //         price,
        //         exponent,
        //         base_currency,
        //       )
        //     is {
        //       Some(expected) -> actual == expected
        //       None -> False
        //     }
        //   },
        // )
        False
      }
    }
  }

  else(_) {
    fail
  }
}
