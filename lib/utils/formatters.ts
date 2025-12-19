export const formatInvoiceStatus = (status?: string | null) => {
	if (!status) return '-';
	const s = String(status).toLowerCase();
	switch (s) {
		case 'paid':
			return 'Pago';
		case 'pending':
			return 'Pendente';
		case 'processing':
			return 'Processando';
		case 'failed':
			return 'Falhou';
		case 'canceled':
		case 'cancelled':
			return 'Cancelado';
		case 'scheduled':
			return 'Agendado';
		case 'overdue':
		case 'past_due':
			return 'Em atraso';
		case 'refunded':
			return 'Estornado';
		case 'active':
		case 'future':
			return 'Ativa';
		case 'inactive':
			return 'Inativa';
		case 'trialing':
			return 'Em teste';
		case 'paused':
			return 'Pausada';
		case 'unpaid':
			return 'Não pago';
		default:
			return status;
	}
};

export const formatPaymentMethod = (method: 'pix' | 'boleto' | 'credit_card') => {
	switch (method) {
		case 'pix': return 'Pix';
		case 'boleto': return 'Boleto';
		case 'credit_card': return 'Cartão';
		default: return method;
	}
};

export const getSubscriptionStatusColor = (status?: string | null) => {
	const s = String(status || '').toLowerCase();
	if (!s) return 'gray';
	switch (s) {
		case 'active':
		case 'paid':
		case 'future':
			return 'green';
		case 'trialing':
		case 'scheduled':
		case 'processing':
		case 'pending':
			return 'yellow';
		case 'overdue':
		case 'past_due':
		case 'unpaid':
			return 'orange';
		case 'failed':
		case 'canceled':
		case 'cancelled':
			return 'red';
		default:
			return 'gray';
	}
};

