use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction}
use pyth.{PriceUpdate, Feed, get_updates}
use types/u32.{U32, from_int}

const ada_price_feed_id = 16

validator osi_accept_pyth(pyth_id: PolicyId, base_asset_id: Int) {
  spend(_datum: Option<Data>, redeemer: Data, _utxo: OutputReference, self: Transaction) {
    expect [update] = get_updates(pyth_id, self)
    let PriceUpdate {
      timestamp_us,
      feeds,
      ..
    } = update
    expect [feed1, feed2] = feeds

   expect Feed {
     feed_id: ada_price_feed_id,
     price: Some(Some(price_1)),
     feed_update_timestamp: Some(Some(timestamp_1)),
     ..
   } = feed1

   expect Feed {
     feed_id: feed_id2,
     price: Some(Some(price_2)),
     feed_update_timestamp: Some(Some(timestamp_2)),
     ..
   } = feed2

   expect feed_id2 == from_int(base_asset_id)

    True
  }

  else(_) {
    False
  }
}
