use aiken/crypto.{Signature}
use cardano/address.{PaymentCredential}
use cardano/assets.{AssetName, PolicyId}
use pyth.{PriceUpdate}

pub type AssetClass {
  policy_id: PolicyId,
  asset_name: AssetName,
}

pub type OsiDatum {
  timestamp: Int,
  payees: Pairs<PaymentCredential, Int>,
  quote_token: AssetClass,
}

pub type OsiRedeemers {
  Fund
  Payout
}
