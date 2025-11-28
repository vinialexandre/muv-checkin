export type PagarmeEnv = {
  apiKey: string
  baseUrl?: string
}

function cfg(env?: Partial<PagarmeEnv>): Required<PagarmeEnv> {
  const apiKey = env?.apiKey || process.env.PAGARME_SECRET_KEY || ''
  const baseUrl = env?.baseUrl || process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'
  return { apiKey, baseUrl }
}

export type EnsureCustomerArgs = {
  externalId: string
  name: string
  email?: string
  document?: string
  phone?: string
}

export type EnsureCustomerResult = {
  customerId: string
}

export async function ensureCustomer(args: EnsureCustomerArgs, env?: Partial<PagarmeEnv>): Promise<EnsureCustomerResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  const searchByCode = args.externalId ? await pagarmeRequest<any>('GET', '/customers', { code: args.externalId, page: 1, size: 1 }, env).catch(() => undefined) : undefined
  const found = Array.isArray(searchByCode?.data) ? searchByCode.data[0] : (Array.isArray(searchByCode) ? searchByCode[0] : undefined)
  if (found?.id) return { customerId: found.id }

  const digits = (args.phone || '').replace(/\D/g, '')
  const country = '55'
  const area = digits.length >= 10 ? digits.slice(-11, -9) || digits.slice(0,2) : undefined
  const number = digits.length >= 10 ? digits.slice(-9) : undefined

  const body: Record<string, any> = {
    name: args.name,
    code: args.externalId,
    email: args.email,
    document: args.document,
    type: 'individual',
  }
  if (area && number) {
    body.phones = { mobile_phone: { country_code: country, area_code: area, number } }
  }

  const created = await pagarmeRequest<any>('POST', '/customers', undefined, env, body)
  if (!created?.id) throw new Error('pagarme_create_customer_failed')
  return { customerId: created.id }
}

export type TokenizeCardArgs = {
  number: string
  holder: string
  expMonth: string
  expYear: string
  cvv: string
}

export type TokenizeCardResult = {
  id: string
}

export async function tokenizeCard(args: TokenizeCardArgs, env?: Partial<PagarmeEnv>): Promise<TokenizeCardResult> {
  const body: Record<string, any> = {
    type: 'card',
    card: {
      number: args.number,
      holder_name: args.holder,
      exp_month: args.expMonth,
      exp_year: args.expYear,
      cvv: args.cvv,
    },
  }

  const publicKey =
    (env?.apiKey && env.apiKey.startsWith('pk_') ? env.apiKey : undefined)
    || process.env.PAGARME_PUBLIC_KEY
    || process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY

  if (!publicKey) {
    throw new Error('pagarme_public_key_missing')
  }

  const baseUrl = env?.baseUrl || process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5'
  const url = `${baseUrl}/tokens?appId=${encodeURIComponent(publicKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    next: { revalidate: 0 },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`pagarme_http_${res.status}: ${text}`)
  }

  const json: any = await res.json()
  const id = json?.id || json?.token
  if (!id) throw new Error('pagarme_tokenize_failed')
  return { id }
}

export type CreateCustomerCardArgs = {
  customerId: string
  cardToken?: string
  cardHash?: string
  billingAddress: {
    zipCode: string
    street: string
    number: string
    complement?: string
    district: string
    city: string
    state: string
    country: string
  }
  holderName?: string
  holderDocument?: string
}

export type CreateCustomerCardResult = {
  cardId: string
}

export async function createCustomerCard(args: CreateCustomerCardArgs, env?: Partial<PagarmeEnv>): Promise<CreateCustomerCardResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  const token = args.cardToken || args.cardHash
  if (!token) throw new Error('pagarme_card_token_missing')
  const a = args.billingAddress
  const line1 = a.number ? `${a.street}, ${a.number}` : a.street
  const body: any = {
    token,
    billing_address: {
      street: a.street,
      number: a.number,
      zip_code: a.zipCode,
      neighborhood: a.district,
      city: a.city,
      state: a.state,
      country: a.country,
      complement: a.complement || '',
      metadata: {},
      line_1: line1,
      line_2: a.complement || '',
    },
  }
  if (args.holderName) body.holder_name = args.holderName
  if (args.holderDocument) body.holder_document = args.holderDocument
  const res = await pagarmeRequest<any>('POST', `/customers/${args.customerId}/cards`, undefined, env, body)
  const cardId = res?.id
  if (!cardId) throw new Error('pagarme_create_card_failed')
  return { cardId }
}


export type CreateSubscriptionArgs = {
  customerId: string
  planId: string
  paymentMethod: 'credit_card'|'pix'|'boleto'
  idempotencyKey?: string
  cardId?: string
  cardToken?: string
  cardHash?: string
  billingAddress?: {
    zipCode: string
    street: string
    number?: string
    complement?: string
    district: string
    city: string
    state: string
    country: string
  }
}

export type CreateSubscriptionResult = {
  subscriptionId: string
  invoiceId?: string
}

export async function createSubscription(args: CreateSubscriptionArgs, env?: Partial<PagarmeEnv>): Promise<CreateSubscriptionResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  const mappedMethod = args.paymentMethod === 'pix' ? 'cash' : args.paymentMethod
  const payload: any = {
    plan_id: args.planId,
    customer_id: args.customerId,
    payment_method: mappedMethod,
  }
  if (args.paymentMethod === 'pix') {
    payload.cash = { type: 'pix' }
  }
  if (mappedMethod === 'credit_card') {
    if (args.cardId) payload.card_id = args.cardId
    else if (args.cardToken) payload.card_token = args.cardToken
    else if (args.cardHash) payload.card_hash = args.cardHash
    if (args.billingAddress) {
      const a = args.billingAddress
      const line1 = a.number ? `${a.street}, ${a.number}` : a.street
      payload.credit_card = payload.credit_card || {}
      payload.credit_card.card = payload.credit_card.card || {}
      payload.credit_card.card.billing_address = {
        country: a.country,
        state: a.state,
        city: a.city,
        zip_code: a.zipCode,
        line_1: line1,
        line_2: a.complement || undefined,
      }
    }
  }
  const headersOverride = args.idempotencyKey ? { 'Idempotency-Key': args.idempotencyKey } : undefined
  const res = await pagarmeRequest<any>('POST', '/subscriptions', undefined, env, payload, headersOverride)
  const subscriptionId = res?.id
  let invoiceId: string | undefined = res?.latest_invoice?.id || res?.first_invoice?.id
  if (!invoiceId && subscriptionId) {
    const invoices = await listInvoicesBySubscription({ subscriptionId, page: 1, size: 1 }, env)
    if (Array.isArray(invoices) && invoices.length) invoiceId = invoices[0].id
  }
  if (!subscriptionId) throw new Error('pagarme_create_subscription_failed')
  return { subscriptionId, invoiceId }
}

export type UpsertPlanArgs = {
  pagarmePlanId?: string
  name: string
  amount: number
  interval: 'day'|'week'|'month'|'year'
  intervalCount: number
  paymentMethods: Array<'credit_card'|'pix'|'boleto'>
  metadata?: Record<string, string | number | boolean | null | undefined>
  status?: 'active'|'inactive'
}

export type UpsertPlanResult = {
  planId: string
}

export async function upsertPlan(args: UpsertPlanArgs, env?: Partial<PagarmeEnv>): Promise<UpsertPlanResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  const normalizedMethods = Array.from(new Set(args.paymentMethods.map((method) => method === 'pix' ? 'cash' : method)))
    .filter((method) => method === 'credit_card' || method === 'boleto' || method === 'cash' || method === 'debit_card')
  if (!normalizedMethods.length) throw new Error('pagarme_invalid_payment_methods')

  const payload: Record<string, any> = {
    name: args.name,
    interval: args.interval,
    interval_count: args.intervalCount,
    payment_methods: normalizedMethods,
    currency: 'BRL',
    billing_type: 'prepaid',
    metadata: args.metadata,
    pricing_scheme: {
      scheme_type: 'unit',
      price: Math.round(args.amount),
    },
    quantity: 1,
  }
  if (payload.metadata === undefined) {
    delete payload.metadata
  }
  if (args.status) {
    payload.status = args.status
  }

	  let shouldCreateNew = false
	  if (args.pagarmePlanId) {
	    try {
	      await pagarmeRequest<any>('GET', `/plans/${args.pagarmePlanId}`, undefined, env)
	    } catch (e) {
	      shouldCreateNew = true
	    }
	  }

	  const pathUrl = (args.pagarmePlanId && !shouldCreateNew) ? `/plans/${args.pagarmePlanId}` : '/plans'
	  const method = (args.pagarmePlanId && !shouldCreateNew) ? 'PUT' : 'POST'
  const res = await pagarmeRequest<any>(method, pathUrl, undefined, env, payload)
  const planId = res?.id || args.pagarmePlanId
  if (!planId) throw new Error('pagarme_plan_sync_failed')
  return { planId }
}

export type DeletePlanArgs = {
  planId: string
}

export type DeletePlanResult = {
  deleted: boolean
  notFound?: boolean
}

export async function deletePlan(args: DeletePlanArgs, env?: Partial<PagarmeEnv>): Promise<DeletePlanResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  try {
    await pagarmeRequest<any>('DELETE', `/plans/${args.planId}`, undefined, env)
    return { deleted: true }
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : ''
    if (message.startsWith('pagarme_http_404')) {
      return { deleted: false, notFound: true }
    }
    throw error
  }
}

export async function findCustomerByExternalId(args: { externalId: string }, env?: Partial<PagarmeEnv>) {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  const res = await pagarmeRequest<any>('GET', '/customers', { code: args.externalId, page: 1, size: 1 }, env)
  if (Array.isArray(res) && res.length) return res[0]
  if (res && Array.isArray(res.data) && res.data.length) return res.data[0]
  return undefined
}

export type PagarmeSubscription = {
  id: string
  plan?: { id?: string; name?: string }
  status?: string
  created_at?: string
  updated_at?: string
  current_period_start?: string
  current_period_end?: string
}

export async function listSubscriptionsByCustomer(args: { customerId: string; page?: number; size?: number }, env?: Partial<PagarmeEnv>) {
  const { customerId, page = 1, size = 20 } = args
  const res = await pagarmeRequest<any>('GET', '/subscriptions', { customer_id: customerId, page, size }, env)
  if (Array.isArray(res)) return res as PagarmeSubscription[]
  if (res && Array.isArray(res.data)) return res.data as PagarmeSubscription[]
  return [] as PagarmeSubscription[]
}

export async function getSubscription(args: { subscriptionId: string }, env?: Partial<PagarmeEnv>) {
  const { subscriptionId } = args
  return pagarmeRequest<PagarmeSubscription>('GET', `/subscriptions/${subscriptionId}`, undefined, env)
}


export type ReissuePixArgs = {
  invoiceId: string
}

export type ReissuePixResult = {
  chargeId: string
  qrCode?: string
  qrCodeUrl?: string
  expiresAt?: string
}

export async function reissuePix(args: ReissuePixArgs, env?: Partial<PagarmeEnv>): Promise<ReissuePixResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  const body = { payment_method: 'cash', cash: { type: 'pix' } }
  const res: any = await pagarmeRequest<any>('POST', `/invoices/${args.invoiceId}/charges`, { expand: 'last_transaction' }, env, body)
  const chargeId = res?.id || res?.charge?.id
  const tx = res?.last_transaction || res?.charge?.last_transaction
  const qrCode = tx?.qr_code || tx?.pix?.qr_code || tx?.copy_paste || tx?.emv || tx?.emvqrcps
  const qrCodeUrl = tx?.qr_code_url || tx?.pix?.qr_code_url || tx?.qr_code_image || tx?.qr_code_base64
  const expiresAt = tx?.expires_at || tx?.pix?.expires_at
  return { chargeId, qrCode, qrCodeUrl, expiresAt }
}

export type ReissueBoletoArgs = {
  invoiceId: string
}

export type ReissueBoletoResult = {
  chargeId: string
  pdf?: string
  line?: string
  barcode?: string
  expiresAt?: string
}

export async function reissueBoleto(args: ReissueBoletoArgs, env?: Partial<PagarmeEnv>): Promise<ReissueBoletoResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  throw new Error('not_implemented')
}

export type CancelSubscriptionArgs = { subscriptionId: string }
export type CancelSubscriptionResult = { canceled: boolean }

export async function cancelSubscription(args: CancelSubscriptionArgs, env?: Partial<PagarmeEnv>): Promise<CancelSubscriptionResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  await pagarmeRequest<any>('DELETE', `/subscriptions/${args.subscriptionId}`, undefined, env)
  return { canceled: true }
}

export type ReactivateSubscriptionArgs = { subscriptionId: string }
export type ReactivateSubscriptionResult = { reactivated: boolean }

export async function reactivateSubscription(args: ReactivateSubscriptionArgs, env?: Partial<PagarmeEnv>): Promise<ReactivateSubscriptionResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  await pagarmeRequest<any>('POST', `/subscriptions/${args.subscriptionId}/reactivate`, undefined, env)
  return { reactivated: true }
}

export type ChangeSubscriptionPlanArgs = { subscriptionId: string; planId: string }
export type ChangeSubscriptionPlanResult = { changed: boolean }

export async function changeSubscriptionPlan(args: ChangeSubscriptionPlanArgs, env?: Partial<PagarmeEnv>): Promise<ChangeSubscriptionPlanResult> {
  const { apiKey } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  await pagarmeRequest<any>('PATCH', `/subscriptions/${args.subscriptionId}`, undefined, env, { plan_id: args.planId })
  return { changed: true }
}



// ---------- GET helpers (MVP: somente leitura) ----------

type Json = Record<string, any>;

function authHeader(apiKey: string) {
  const token = Buffer.from(`${apiKey}:`).toString('base64')
  return `Basic ${token}`
}

async function pagarmeRequest<T>(
  method: 'GET'|'POST'|'PATCH'|'DELETE'|'PUT',
  path: string,
  query?: Record<string, string|number|boolean|undefined>,
  env?: Partial<PagarmeEnv>,
  body?: any,
  headersOverride?: Record<string,string>,
): Promise<T> {
  const { apiKey, baseUrl } = cfg(env)
  if (!apiKey) throw new Error('pagarme_api_key_missing')
  const qs = query
    ? '?' + new URLSearchParams(
        Object.fromEntries(
          Object.entries(query).filter(([,v]) => v !== undefined)
            .map(([k,v]) => [k, String(v)])
        )
      ).toString()
    : ''
  const url = `${baseUrl}${path}${qs}`
  const headers: Record<string,string> = {
    'Authorization': authHeader(apiKey),
    'Accept': 'application/json',
  }
  if (body) headers['Content-Type'] = 'application/json'
  const mergedHeaders = headersOverride ? { ...headers, ...headersOverride } : headers
  const res = await fetch(url, {
    method,
    headers: mergedHeaders,
    cache: 'no-store',
    next: { revalidate: 0 },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`pagarme_http_${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export type PagarmeInvoice = {
  id: string
  code?: string
  status: string
  amount: number
  due_at?: string
  created_at?: string
  updated_at?: string
}

export type PagarmeTransactionPix = {
  qr_code?: string
  qr_code_url?: string
  expires_at?: string
  status?: string
}

export type PagarmeTransactionBoleto = {
  boleto?: {
    pdf?: string
    line?: string
    barcode?: string
    expires_at?: string
  }
  status?: string
}

export type PagarmeTransaction = (PagarmeTransactionPix & PagarmeTransactionBoleto) & {
  id?: string
  transaction_type?: string
}

export type PagarmeCharge = {
  id: string
  status: string
  payment_method: 'pix'|'boleto'|'credit_card'|string
  amount: number
  paid_at?: string
  created_at?: string
  last_transaction?: PagarmeTransaction
}

export async function getInvoice(args: { invoiceId: string }, env?: Partial<PagarmeEnv>) {
  const { invoiceId } = args
  return pagarmeRequest<PagarmeInvoice>('GET', `/invoices/${invoiceId}`, undefined, env)
}

export async function listChargesByInvoice(args: { invoiceId: string; page?: number; size?: number }, env?: Partial<PagarmeEnv>) {
  const { invoiceId, page = 1, size = 20 } = args
  const res = await pagarmeRequest<any>('GET', `/charges`, { invoice_id: invoiceId, page, size, expand: 'last_transaction' }, env)
  if (Array.isArray(res)) return res as PagarmeCharge[]
  if (res && Array.isArray(res.data)) return res.data as PagarmeCharge[]
  return [] as PagarmeCharge[]
}

export async function getCharge(args: { chargeId: string }, env?: Partial<PagarmeEnv>) {
  const { chargeId } = args
  return pagarmeRequest<any>('GET', `/charges/${chargeId}`, { expand: 'last_transaction' }, env)
}

export async function getTransaction(args: { transactionId: string }, env?: Partial<PagarmeEnv>) {
  const { transactionId } = args
  return pagarmeRequest<any>('GET', `/transactions/${transactionId}`, undefined, env)
}

export async function listInvoicesBySubscription(args: { subscriptionId: string; page?: number; size?: number }, env?: Partial<PagarmeEnv>) {
  const { subscriptionId, page = 1, size = 20 } = args
  const res = await pagarmeRequest<any>('GET', `/invoices`, { subscription_id: subscriptionId, page, size }, env)
  if (Array.isArray(res)) return res as PagarmeInvoice[]
  if (res && Array.isArray(res.data)) return res.data as PagarmeInvoice[]
  return [] as PagarmeInvoice[]
}
