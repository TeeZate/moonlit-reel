# @synthpay/trustledger-sdk

Server-side merchant SDK for **SynthPay TrustLedger**. Charge a viewer's SynthPay
balance per request, straight from your backend. Your API key stays on the
server; every charge is written to the public, tamper-evident ledger.

## Install

```bash
npm install @synthpay/trustledger-sdk
```

## Setup (one-time, in the SynthPay dashboard)

1. Register your merchant at <https://dashboard.synthpay.tech> and copy your **API key**.
2. Create a priced **endpoint** (e.g. `/watch` at `$0.02`) and copy its **endpoint id**.

Keep the API key in an environment variable — never commit it, never send it to the browser.

## Charge the signed-in viewer

The viewer signs in with SynthPay (their own passkey) and your frontend receives
a short-lived **viewer token**. Pass it straight through — SynthPay resolves the
viewer, so a merchant can only ever charge someone who actually signed in:

```js
const { TrustLedger } = require('@synthpay/trustledger-sdk')

const tl = new TrustLedger({ apiKey: process.env.SYNTHPAY_API_KEY })

const receipt = await tl.charge({
  endpointId:  process.env.SYNTHPAY_ENDPOINT_ID,
  viewerToken: req.body.viewerToken,       // from "Sign in with SynthPay"
})
// → { success: true, amount: 0.02, balanceAfter: 4.81, merchant, endpoint, duplicate }
```

If the viewer can't pay, `charge()` throws a `TrustLedgerError` with
`code === 'insufficient_balance'` (and `topupUrl`). Other codes: `unauthorized`
(missing/expired viewer token or bad API key), `rate_limited`, `not_found`,
`request_failed`.

### Typical serverless handler

```js
exports.handler = async (event) => {
  const { viewerToken } = JSON.parse(event.body)
  try {
    const charge = await tl.charge({ endpointId: process.env.SYNTHPAY_ENDPOINT_ID, viewerToken })
    return { statusCode: 200, body: JSON.stringify({ url: SIGNED_CONTENT_URL, charged: charge.amount }) }
  } catch (err) {
    if (err.code === 'insufficient_balance') return { statusCode: 402, body: JSON.stringify({ error: err.message, topup_url: err.topupUrl }) }
    if (err.code === 'unauthorized')        return { statusCode: 401, body: JSON.stringify({ error: 'sign_in' }) }
    return { statusCode: 502, body: JSON.stringify({ error: 'Payment failed' }) }
  }
}
```

## License

MIT
