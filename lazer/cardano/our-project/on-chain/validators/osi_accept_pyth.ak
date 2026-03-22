use aiken/collection/list
use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction}
use pyth
use types/u32

validator osi_accept_pyth(){//pyth_id: PolicyId) {
  spend(_datum: Option<Data>, redeemer: Data, _utxo: OutputReference, self: Transaction) {
    True
  }

  else(_) {
    False
  }
}
