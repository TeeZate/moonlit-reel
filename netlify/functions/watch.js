'use strict'

// ============================================================================
// Love Buster Show — gated content endpoint
// ----------------------------------------------------------------------------
// How a third-party merchant integrates TrustLedger: install the SDK, keep the
// merchant API key server-side, and charge the *signed-in viewer* before
// handing back the video URL. The browser sends only a movieId + the viewer's
// own SynthPay token — never the API key or the content URL.
//
// Required environment variables (Netlify → Site settings → Environment):
//   SYNTHPAY_API_KEY            merchant API key (from dashboard.synthpay.tech)
//   SYNTHPAY_ENDPOINT_POOR_MAID endpoint id for the "Poor Maid…" title
// Optional:
//   SYNTHPAY_API_URL            override the TrustLedger base URL
// ============================================================================

const { TrustLedger, TrustLedgerError } = require('@synthpay/trustledger-sdk')

let _tl
function client() {
  if (!process.env.SYNTHPAY_API_KEY) return null
  if (!_tl) {
    _tl = new TrustLedger({
      apiKey: process.env.SYNTHPAY_API_KEY,
      ...(process.env.SYNTHPAY_API_URL ? { baseUrl: process.env.SYNTHPAY_API_URL } : {}),
    })
  }
  return _tl
}

// Catalog lives server-side: each title maps to its priced endpoint + the real
// content URL, which is only released after payment.
const CATALOG = {
  'poor-maid-marries-a-billionaire': {
    endpointId: process.env.SYNTHPAY_ENDPOINT_POOR_MAID,
    url: 'https://archive.org/download/poor-maid-marries-a-billionaire-at-all-costs-full-movie-love-buster-show-1080p/Poor_Maid_Marries_A_Billionaire_At_All_Costs___Full_Movie___@LoveBusterShow(1080p).mp4',
  },
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch (_) {
    return json(400, { error: 'Invalid request body' })
  }

  const title = CATALOG[body.movieId]
  if (!title) {
    return json(404, { error: 'Unknown title' })
  }

  const tl = client()
  if (!tl || !title.endpointId) {
    return json(503, { error: 'Payments are not configured yet.' })
  }

  if (!body.viewerToken) {
    return json(401, { error: 'sign_in' })
  }

  try {
    const charge = await tl.charge({ endpointId: title.endpointId, viewerToken: body.viewerToken })
    return json(200, { url: title.url, charged: charge.amount, balance_after: charge.balanceAfter })
  } catch (err) {
    if (err instanceof TrustLedgerError) {
      if (err.code === 'insufficient_balance') return json(402, { error: err.message, topup_url: err.topupUrl })
      if (err.code === 'unauthorized')        return json(401, { error: 'sign_in' })   // viewer token expired
      if (err.code === 'rate_limited')        return json(429, { error: err.message })
    }
    return json(502, { error: 'Payment could not be processed. Please try again.' })
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
