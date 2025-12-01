import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { adminDb } from '@/lib/firebase-admin'
import { deletePlan } from '@/lib/payments/pagarme'

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!adminDb) {
    return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })
  }

  const { id: planId } = await context.params as any
  if (!planId) {
    return NextResponse.json({ error: 'plan_id_obrigatorio' }, { status: 400 })
  }

  const ref = adminDb.collection('plans').doc(planId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: 'plano_nao_encontrado' }, { status: 404 })
  }

  const studentsWithPlanSnap = await adminDb
    .collection('students')
    .where('activePlanId', '==', planId)
    .limit(1)
    .get()

  if (!studentsWithPlanSnap.empty) {
    return NextResponse.json({ error: 'plano_possui_assinaturas_ativas' }, { status: 400 })
  }

  const plan = snap.data() as any
  const pagarmePlanId = typeof plan?.pagarmePlanId === 'string' && plan.pagarmePlanId ? plan.pagarmePlanId : undefined

  let pagarmeDeleted = false
  let pagarmeNotFound = false

  if (pagarmePlanId) {
    try {
      const result = await deletePlan({ planId: pagarmePlanId })
      pagarmeDeleted = result.deleted
      pagarmeNotFound = !!result.notFound
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'erro_excluir_plano_pagarme'
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  await ref.delete()

  return NextResponse.json({ ok: true, pagarmeDeleted, pagarmeNotFound })
}

export const runtime = 'nodejs'

