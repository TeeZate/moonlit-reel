'use strict'

/**
 * @synthpay/trustledger-sdk
 *
 * Server-side merchant SDK for SynthPay's TrustLedger. You authenticate with
 * your merchant API key (a server secret — never ship it to the browser) and
 * charge a viewer's SynthPay balance for one of your priced endpoints. Every
 * charge lands on the public, tamper-evident ledger.
 */

const DEFAULT_BASE_URL = 'https://trustledger-production.up.railway.app'

class TrustLedgerError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, topupUrl?: string }} [meta]
   */
  constructor(message, meta = {}) {
    super(message)
    this.name = 'TrustLedgerError'
    this.status = meta.status
    // code ∈ unauthorized | insufficient_balance | rate_limited | not_found | request_failed
    this.code = meta.code || 'request_failed'
    this.topupUrl = meta.topupUrl
  }
}

const STATUS_TO_CODE = {
  401: 'unauthorized',
  402: 'insufficient_balance',
  404: 'not_found',
  429: 'rate_limited',
}

class TrustLedger {
  /**
   * @param {{ apiKey: string, baseUrl?: string, fetch?: typeof fetch }} opts
   */
  constructor(opts = {}) {
    if (!opts.apiKey) {
      throw new TrustLedgerError('A merchant apiKey is required', { code: 'unauthorized' })
    }
    this.apiKey = opts.apiKey
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
    this._fetch = opts.fetch || globalThis.fetch
    if (typeof this._fetch !== 'function') {
      throw new TrustLedgerError('No fetch implementation found; pass { fetch } (Node 18+ has it built in)', {
        code: 'request_failed',
      })
    }
  }

  /**
   * Charge a viewer for one of your endpoints. The price is taken from the
   * endpoint server-side — the caller never sets the amount.
   *
   * The viewer is identified by their own signed SynthPay token (`viewerToken`,
   * obtained when they sign in with SynthPay). A raw `userId` is still accepted
   * for trusted server-to-server use.
   *
   * @param {{ endpointId: string, viewerToken?: string, userId?: string }} args
   * @returns {Promise<{ success: true, amount: number, balanceAfter: number, merchant: string, endpoint: string, duplicate: boolean }>}
   * @throws {TrustLedgerError} on insufficient balance (402), bad key/expired token (401), etc.
   */
  async charge(args = {}) {
    const { endpointId, viewerToken, userId } = args
    if (!endpointId || (!viewerToken && !userId)) {
      throw new TrustLedgerError('endpointId and a viewerToken (or userId) are required', { code: 'request_failed' })
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }
    if (viewerToken) headers['X-SynthPay-Viewer'] = `Bearer ${viewerToken}`

    let res
    try {
      res = await this._fetch(`${this.baseUrl}/v1/charge`, {
        method: 'POST',
        headers,
        body: JSON.stringify(userId ? { user_id: userId, endpoint_id: endpointId } : { endpoint_id: endpointId }),
      })
    } catch (err) {
      throw new TrustLedgerError(`Could not reach TrustLedger: ${err.message}`, { code: 'request_failed' })
    }

    const data = await res.json().catch(() => ({}))

    if (res.ok && data.success) {
      return {
        success: true,
        amount: data.amount,
        balanceAfter: data.balance_after,
        merchant: data.merchant,
        endpoint: data.endpoint,
        duplicate: Boolean(data.duplicate),
      }
    }

    throw new TrustLedgerError(data.error || `Charge failed (HTTP ${res.status})`, {
      status: res.status,
      code: STATUS_TO_CODE[res.status] || 'request_failed',
      topupUrl: data.topup_url,
    })
  }
}

module.exports = { TrustLedger, TrustLedgerError }
