export interface TrustLedgerOptions {
  /** Merchant API key — a server-side secret. Never expose to the browser. */
  apiKey: string
  /** Override the TrustLedger API base URL. Defaults to production. */
  baseUrl?: string
  /** Custom fetch implementation. Defaults to global fetch (Node 18+). */
  fetch?: typeof fetch
}

export interface ChargeArgs {
  /** One of your merchant endpoints. Price is taken from it server-side. */
  endpointId: string
  /** The viewer's signed SynthPay token (from "Sign in with SynthPay"). */
  viewerToken?: string
  /** Raw viewer id — trusted server-to-server use only. */
  userId?: string
}

export interface ChargeReceipt {
  success: true
  amount: number
  balanceAfter: number
  merchant: string
  endpoint: string
  duplicate: boolean
}

export type TrustLedgerErrorCode =
  | 'unauthorized'
  | 'insufficient_balance'
  | 'rate_limited'
  | 'not_found'
  | 'request_failed'

export class TrustLedgerError extends Error {
  status?: number
  code: TrustLedgerErrorCode
  topupUrl?: string
}

export class TrustLedger {
  constructor(opts: TrustLedgerOptions)
  charge(args: ChargeArgs): Promise<ChargeReceipt>
}
