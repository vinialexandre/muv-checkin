import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { ensureCustomer, createSubscription, createCustomerCard } from '@/lib/payments/pagarme'

const onlyDigits = (value?: string) => String(value || '').replace(/\D/g, '')
const trimOrEmpty = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const isValidPaymentMethod = (method: unknown): method is 'pix' | 'boleto' | 'credit_card' =>
  method === 'pix' || method === 'boleto' || method === 'credit_card'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch (parseError: any) {
    console.error('[subscribe/complete] Erro ao parsear JSON:', parseError)
    return NextResponse.json({ error: 'json_invalido' }, { status: 400 })
  }

  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })
    }

    const { token, paymentMethod, billingContact, billingAddress, planId: requestedPlanId, cardToken, cardHash } = body

    if (!token) {
      return NextResponse.json({ error: 'token_obrigatorio' }, { status: 400 })
    }
    if (!isValidPaymentMethod(paymentMethod)) {
      return NextResponse.json({ error: 'metodo_pagamento_invalido' }, { status: 400 })
    }

    const inviteRef = adminDb.collection('subscription_invites').doc(String(token))
    const inviteSnap = await inviteRef.get()
    if (!inviteSnap.exists) {
      return NextResponse.json({ error: 'convite_invalido' }, { status: 404 })
    }

    const invite = inviteSnap.data() as any
    if (invite?.disabled) {
      return NextResponse.json({ error: 'convite_desabilitado' }, { status: 410 })
    }

    const studentId = String(invite.studentId)
    const rawBillingDay = Number(invite?.billingDay)
    const billingDay = rawBillingDay >= 1 && rawBillingDay <= 28 ? rawBillingDay : undefined

    const allowedPlanIds: string[] = Array.isArray(invite?.allowedPlanIds) && invite.allowedPlanIds.length
      ? invite.allowedPlanIds.map((x: any) => String(x))
      : [String(invite.planId)]

    const finalPlanId = requestedPlanId ? String(requestedPlanId) : String(invite.planId)
    if (!allowedPlanIds.includes(finalPlanId)) {
      return NextResponse.json({ error: 'plano_nao_permitido', allowedPlanIds }, { status: 403 })
    }

    const studentRef = adminDb.collection('students').doc(studentId)
    const studentSnap = await studentRef.get()
    if (!studentSnap.exists) {
      return NextResponse.json({ error: 'aluno_nao_encontrado' }, { status: 404 })
    }
    const student = studentSnap.data() as any

    const planRef = adminDb.collection('plans').doc(finalPlanId)
    const planSnap = await planRef.get()
    if (!planSnap.exists) {
      return NextResponse.json({ error: 'plano_nao_encontrado' }, { status: 404 })
    }
    const plan = planSnap.data() as any

    if (!Array.isArray(plan?.paymentMethods) || !plan.paymentMethods.includes(paymentMethod)) {
      return NextResponse.json({ error: 'metodo_pagamento_nao_permitido_no_plano' }, { status: 400 })
    }
    if (!plan?.pagarmePlanId) {
      return NextResponse.json({ error: 'plano_sem_pagarme_plan_id' }, { status: 400 })
    }

    const existingContact = student?.billingContact || {}
    const incomingContact = billingContact || {}

    const contactName = trimOrEmpty(incomingContact.name ?? existingContact.name ?? student?.name)
    const contactEmail = trimOrEmpty(incomingContact.email ?? existingContact.email ?? student?.email)
    const contactDocument = onlyDigits(incomingContact.document ?? existingContact.document)
    const contactPhone = onlyDigits(incomingContact.phone ?? existingContact.phone ?? student?.phone ?? student?.whatsapp)
    const contactCountryCode = onlyDigits(incomingContact.countryCode ?? existingContact.countryCode ?? '55') || '55'

    const addressRequired = true
    const existingAddress = student?.billingAddress || {}
    const incomingAddress = billingAddress || {}

    const addressZip = onlyDigits(incomingAddress.zipCode ?? existingAddress.zipCode)
    const addressStreet = trimOrEmpty(incomingAddress.street ?? existingAddress.street)
    const addressNumber = trimOrEmpty(incomingAddress.number ?? existingAddress.number)
    const addressComplement = trimOrEmpty(incomingAddress.complement ?? existingAddress.complement)
    const addressDistrict = trimOrEmpty(incomingAddress.district ?? existingAddress.district)
    const addressCity = trimOrEmpty(incomingAddress.city ?? existingAddress.city)
    const addressState = trimOrEmpty(incomingAddress.state ?? existingAddress.state).toUpperCase()
    const addressCountry = trimOrEmpty((incomingAddress.country ?? existingAddress.country ?? 'BR')).toUpperCase()

    const missing = {
      name: !contactName,
      email: !contactEmail,
      document: contactDocument.length !== 11,
      phone: contactPhone.length < 10,
      zipCode: addressRequired && addressZip.length !== 8,
      street: addressRequired && !addressStreet,
      number: addressRequired && !addressNumber,
      district: addressRequired && !addressDistrict,
      city: addressRequired && !addressCity,
      state: addressRequired && addressState.length !== 2,
      country: addressRequired && !addressCountry,
    }

    if (Object.values(missing).some(Boolean)) {
      return NextResponse.json({ error: 'dados_cobranca_incompletos', missing }, { status: 400 })
    }
    if (paymentMethod === 'credit_card' && !cardToken && !cardHash) {
      return NextResponse.json({ error: 'cartao_nao_tokenizado' }, { status: 400 })
    }


    const ensured = await ensureCustomer({
      externalId: studentId,
      name: contactName,
      email: contactEmail || undefined,
      document: contactDocument,
      phone: contactPhone,
    })

    let cardId: string | undefined
    if (paymentMethod === 'credit_card') {
      const createdCard = await createCustomerCard({
        customerId: ensured.customerId,
        cardToken,
        cardHash,
        billingAddress: {
          zipCode: addressZip,
          street: addressStreet,
          number: addressNumber,
          complement: addressComplement || undefined,
          district: addressDistrict,
          city: addressCity,
          state: addressState,
          country: addressCountry,
        },
        holderName: contactName,
        holderDocument: contactDocument,
      })
      cardId = createdCard.cardId
    }

    let startAt: string | undefined
    if (billingDay && billingDay >= 1 && billingDay <= 28) {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      const candidate = new Date(currentYear, currentMonth, billingDay, 0, 0, 0, 0)
      const effective = candidate <= now ? new Date(currentYear, currentMonth + 1, billingDay, 0, 0, 0, 0) : candidate
      startAt = effective.toISOString()
    }

    const created = await createSubscription({
      customerId: ensured.customerId,
      planId: String(plan.pagarmePlanId),
      paymentMethod,
      idempotencyKey: `subscribe:${studentId}:${String(plan.pagarmePlanId)}:${String(token)}`,
      cardId: paymentMethod === 'credit_card' ? cardId : undefined,
      cardToken: paymentMethod === 'credit_card' ? undefined : cardToken,
      cardHash: paymentMethod === 'credit_card' ? undefined : cardHash,
      billingAddress: addressRequired ? {
        zipCode: addressZip,
        street: addressStreet,
        number: addressNumber,
        complement: addressComplement,
        district: addressDistrict,
        city: addressCity,
        state: addressState,
        country: addressCountry,
      } : undefined,
      billingDay,
      startAt,
    })

    const contactToSave: Record<string, any> = {
      name: contactName,
      email: contactEmail,
      document: contactDocument,
      phone: contactPhone,
    }
    if (contactCountryCode) contactToSave.countryCode = contactCountryCode

    const addressToSaveCandidate: Record<string, any> = {
      zipCode: addressZip,
      street: addressStreet,
      number: addressNumber,
      district: addressDistrict,
      city: addressCity,
      state: addressState,
      country: addressCountry,
    }
    if (addressComplement) {
      addressToSaveCandidate.complement = addressComplement
    }
    const hasAddressData = Object.values(addressToSaveCandidate).some((value) => value)

    const updatePayload: Record<string, any> = {
      pagarmeCustomerId: ensured.customerId,
      pagarmeSubscriptionId: created.subscriptionId,
      paymentPreference: paymentMethod,
      paymentStatus: 'pending',
      activePlanId: finalPlanId,
      updatedAt: new Date().toISOString(),
      billingContact: contactToSave,
    }
    if (billingDay) {
      updatePayload.billingDay = billingDay
    }
    if (hasAddressData) {
      updatePayload.billingAddress = addressToSaveCandidate
    }

    await studentRef.update(updatePayload)
    await inviteRef.update({ disabled: true, usedAt: new Date().toISOString() })

    return NextResponse.json({ ok: true, subscriptionId: created.subscriptionId, invoiceId: created.invoiceId })
  } catch (e: any) {
    console.error('[subscribe/complete] Erro:', e?.message || e)
    const raw = typeof e?.message === 'string' ? e.message : String(e || '')
    let errorCode = 'erro_generico'
    let status = 500
    let details = raw

    if (raw === 'pagarme_api_key_missing') {
      errorCode = 'config_pagamento_indisponivel'
    } else if (raw === 'pagarme_create_customer_failed') {
      errorCode = 'falha_criar_cliente_pagador'
    } else if (raw === 'pagarme_create_card_failed') {
      errorCode = 'falha_cadastrar_cartao'
    } else if (raw === 'pagarme_create_subscription_failed') {
      errorCode = 'falha_criar_assinatura_gateway'
    } else if (raw.includes('pagarme_http_')) {
      const httpDetails = raw.split(': ').slice(1).join(': ')
      details = httpDetails || raw
      if (raw.includes('pagarme_http_402')) {
        errorCode = 'pagamento_recusado'
        status = 400
      } else if (raw.includes('pagarme_http_400')) {
        errorCode = 'dados_pagamento_invalidos'
        status = 400
      } else if (raw.includes('pagarme_http_401') || raw.includes('pagarme_http_403')) {
        errorCode = 'pagamento_nao_autorizado'
        status = 400
      } else {
        errorCode = 'falha_processar_pagamento'
        status = 502
      }
    }

    return NextResponse.json({ ok: false, error: errorCode, details }, { status })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
