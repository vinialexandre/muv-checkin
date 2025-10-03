import Link from 'next/link'
import { listInvoicesBySubscription, PagarmeInvoice } from '@/lib/payments/pagarme'

function brl(amount: number) {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((amount||0)/100) } catch { return `${(amount||0)/100}` }
}

export default async function SubscriptionInvoicesPage({ params }: { params: Promise<{ subscription: string }> }) {
  const { subscription: subscriptionId } = await params
  const invoices = await listInvoicesBySubscription({ subscriptionId })
  const rows = (Array.isArray(invoices) ? invoices : []) as PagarmeInvoice[]

  return (
    <div style={{ padding: 24, maxWidth: 880 }}>
      <h1>Faturas da assinatura</h1>
      <div style={{ marginBottom: 12 }}>
        <strong>Assinatura:</strong> {subscriptionId}
      </div>

      {rows.length === 0 ? (
        <div><em>Nenhuma fatura encontrada.</em></div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Fatura</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Valor</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Vencimento</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv.id}>
                <td style={{ padding: 8 }}>{inv.id}</td>
                <td style={{ padding: 8 }}>{inv.status}</td>
                <td style={{ padding: 8 }}>{brl(inv.amount)}</td>
                <td style={{ padding: 8 }}>{inv.due_at ? new Date(inv.due_at).toLocaleDateString('pt-BR') : '-'}</td>
                <td style={{ padding: 8 }}>
                  <Link href={`/pay/${inv.id}`}>Pagar/Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

