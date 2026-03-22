use aiken/collection/list
use aiken/collection/pairs
use aiken/interval
use aiken/math/rational
use cardano/address.{Script}
use cardano/assets.{PolicyId, lovelace_of}
use cardano/transaction.{
  Output, OutputReference, Transaction, find_script_outputs,
}
use otypes.{Fund, OsiDatum, OsiRedeemers, Payout}
use pyth.{PriceUpdate, get_updates}
use types/u32
use types/u64
use utils.{quote_price_multiplier}

/// Oracle-settled Invoice
validator oracle_settled_invoice(base_currency: Int, pyth_policy: PolicyId) {
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
        let OsiDatum { deadline, payees } = datum

        expect [price_update] = get_updates(pyth_policy, tx)

        expect [feed1, feed2] = price_update.feeds

        let base_currency_feed_match =
          u32.as_int(feed1.feed_id) == base_currency

        let quote_multiplier = quote_price_multiplier(feed1, feed2)

        let feed_time_within_range =
          tx.validity_range
            |> interval.contains(u64.as_int(price_update.timestamp_us))

        let payment_before_deadline =
          tx.validity_range
            |> interval.is_entirely_before(deadline)

        let payouts_match =
          payees
            |> pairs.foldl(
                True,
                fn(k, v, r) {
                  let outputs_value =
                    outputs
                      |> list.filter_map(
                          fn(out) {
                            if out.address.payment_credential == k {
                              Some(out.value)
                            } else {
                              None
                            }
                          },
                        )
                      |> list.foldl(
                          0,
                          fn(value, accumulator) {
                            lovelace_of(value) + accumulator
                          },
                        )
                  expect Some(expected_payout) =
                    rational.div(rational.from_int(v), quote_multiplier)
                  (outputs_value >= rational.floor(expected_payout))? && r
                },
              )
        payouts_match? && base_currency_feed_match? && feed_time_within_range? && payment_before_deadline?
      }
    }
  }

  else(_) {
    fail
  }
}
