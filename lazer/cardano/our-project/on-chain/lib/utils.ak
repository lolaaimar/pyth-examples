use aiken/math/rational.{Rational}
use aiken/option
use pyth.{Feed}

pub fn quote_price_multiplier(base_feed: Feed, quote_feed: Feed) -> Rational {
  expect Some(b_exponent) = base_feed.exponent
  expect Some(q_exponent) = quote_feed.exponent

  expect Some(multiplier) =
    rational.from_int(10) |> rational.pow(b_exponent - q_exponent)

  expect Some(base_price) = option.flatten(base_feed.price)
  expect Some(quote_price) = option.flatten(quote_feed.price)

  expect Some(price_ratio) = rational.new(base_price, quote_price)

  rational.mul(price_ratio, multiplier)
}
