use aiken/collection/list
use aiken/collection/pairs
use aiken/option
use cardano/address.{PaymentCredential, Script}
use cardano/assets.{AssetName, PolicyId}
use cardano/transaction.{
  Output, OutputReference, Transaction, find_script_outputs,
}
use pyth.{PriceUpdate}
use types.{Fund, OsiDatum, OsiRedeemers, Payout}

fn pow10(n: Int) -> Int {
  if n <= 0 {
    1
  } else {
    10 * pow10(n - 1)
  }
}

fn expected_quote_amount(
  base_amount: Int,
  price: Int,
  exponent: Int,
  base_currency: Int,
) -> Int {
  if exponent >= 0 {
    base_amount * price * pow10(exponent) / base_currency
  } else {
    base_amount * price / ( base_currency * pow10(0 - exponent) )
  }
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
validator oracleSettled(base_currency: Int) {
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

      Payout { signature: _, feeds } -> {
        expect Some(datum) = datum
        let OsiDatum { timestamp, payees, quote_token } = datum

        // REVIEW
        expect Some(feed) = list.head(feeds.feeds)
        expect Some(Some(price)) = feed.price
        expect Some(exponent) = feed.exponent

        list.all(
          outputs,
          fn(out) {
            let actual =
              assets.quantity_of(
                out.value,
                quote_token.policy_id,
                quote_token.asset_name,
              )

            let payee_cred = out.address.payment_credential
            when
              expected_for_credential(
                payees,
                payee_cred,
                price,
                exponent,
                base_currency,
              )
            is {
              Some(expected) -> actual == expected
              None -> False
            }
          },
        )
      }
    }
  }

  else(_) {
    fail
  }
}
