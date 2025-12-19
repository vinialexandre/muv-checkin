import { getSubscription } from '@/lib/payments/pagarme'
import { formatInvoiceStatus } from '@/lib/utils/formatters'

export default async function SubscriptionInvoicesPage({ params }: { params: Promise<{ subscription: string }> }) {
  const { subscription: subscriptionId } = await params
  const subscription = await getSubscription({ subscriptionId }).catch(() => undefined)

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 880 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 4px 6px rgba(16,24,40,.1)', padding: 48 }}>
          <h1 style={{ margin: 0, fontSize: 32, marginBottom: 32, textAlign: 'center', color: '#111827' }}>Assinatura Confirmada</h1>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28, fontSize: 16 }}>
            <div><strong>ID:</strong> {subscriptionId}</div>
            <div><strong>Status:</strong> {formatInvoiceStatus(subscription?.status)}</div>
            {subscription?.plan?.name && <div><strong>Plano:</strong> {subscription.plan.name}</div>}
            {subscription?.created_at && <div><strong>Criada em:</strong> {new Date(subscription.created_at).toLocaleDateString('pt-BR')}</div>}
          </div>

          {subscription?.current_period_start && subscription?.current_period_end && (
            <div style={{ padding: 20, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 32 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 16 }}>
                <div><strong>Início do período:</strong> {new Date(subscription.current_period_start).toLocaleDateString('pt-BR')}</div>
                <div><strong>Fim do período:</strong> {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
          )}

          <div style={{ padding: 24, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 18, color: '#166534', fontWeight: 500 }}>
              Sua assinatura foi confirmada com sucesso. Você pode fechar esta aba agora.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

