use cardano/address.{PaymentCredential}
use cardano/assets.{AssetName, PolicyId}

pub type AssetClass {
  policy_id: PolicyId,
  asset_name: AssetName,
}

pub type OsiDatum {
  deadline: Int,
  payees: Pairs<PaymentCredential, Int>,
}

pub type OsiRedeemers {
  Fund
  Payout
}
