import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertIcon, AlertTitle, Badge, Box, Button, Checkbox, FormControl, FormErrorMessage, FormLabel, HStack, Input, Select, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast } from '@chakra-ui/react';
import { Controller, Control, UseFormWatch } from 'react-hook-form';
import { Icon } from '@/components/Icon';
import PageCard from '@/components/PageCard';
import { StudentFormData } from '@/app/admin/students/formConfig';
import { formatInvoiceStatus, formatPaymentMethod, getSubscriptionStatusColor } from '@/lib/utils/formatters';

type Plan = { id: string; name: string; price?: number; paymentMethods?: Array<'pix' | 'boleto' | 'credit_card'>; };

interface Props {
	mode: 'new' | 'edit';
	studentId?: string;
	control: Control<StudentFormData>;
	watch: UseFormWatch<StudentFormData>;
	plans: Plan[];
	currencyFormatter: Intl.NumberFormat;
	studentNameValue: string;
}

export default function SubscriptionTab({ mode, studentId, control, watch, plans, currencyFormatter, studentNameValue }: Props) {
	const toast = useToast();
	const [allowPlanChange, setAllowPlanChange] = useState(false);
	const [inviteLink, setInviteLink] = useState('');
	const [generatingInvite, setGeneratingInvite] = useState(false);
	const [subSummary, setSubSummary] = useState<any>(null);
	const [subLoading, setSubLoading] = useState(mode === 'edit' && !!studentId);
	const [billingDay, setBillingDay] = useState<number | ''>('');

	const activePlanIdValue = watch('activePlanId');
	const billingDayValue = watch('billingDay');
	const discountValue = watch('subscriptionDiscount');
	const selectedPlan = plans.find((plan) => plan.id === activePlanIdValue);
	const selectedPlanMethods = selectedPlan?.paymentMethods?.map((method) => formatPaymentMethod(method)).join(' · ');

	const calculateDiscountedPrice = () => {
		if (!selectedPlan?.price || !discountValue || discountValue <= 0) {
			return selectedPlan?.price || 0;
		}
		return selectedPlan.price * (1 - discountValue / 100);
	};
	const [invoices, setInvoices] = useState<any[] | null>(null);
	const [invoicesLoading, setInvoicesLoading] = useState(false);
	const hasSubscription = !!subSummary;
	const hasInvoices = Array.isArray(invoices) && invoices.length > 0;
	const showInvoicesTable = mode === 'edit' && !!studentId && hasSubscription;

	useEffect(() => {
		if (!studentId || mode !== 'edit') return;
		let cancelled = false;
		(async () => {
			try {
				setSubLoading(true);
				const s = await fetch(`/api/students/${studentId}/subscription`, { cache: 'no-store' });
				const sj = await s.json().catch(() => ({}));
				if (!cancelled) setSubSummary(sj?.subscription || null);
			} catch { }
			finally {
				if (!cancelled) setSubLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [studentId, mode]);

	useEffect(() => {
		if (mode === 'edit' && billingDayValue && !billingDay) {
			const day = Number(billingDayValue);
			if (day >= 1 && day <= 31) {
				setBillingDay(day);
			}
		}
	}, [mode, billingDayValue, billingDay]);

	useEffect(() => {
		if (!studentId || mode !== 'edit') return;
		let cancelled = false;
		(async () => {
			try {
				setInvoicesLoading(true);
				const res = await fetch(`/api/students/${studentId}/subscription/invoices`, { cache: 'no-store' });
				const json = await res.json().catch(() => ({}));
				const list = Array.isArray(json?.invoices) ? json.invoices : [];
				if (!cancelled) setInvoices(list);
			} catch {
				if (!cancelled) setInvoices([]);
			} finally {
				if (!cancelled) setInvoicesLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [studentId, mode]);

	const handleGenerateInvite = async () => {
		if (mode === 'new' || !studentId) {
			toast({ status: 'warning', title: 'Salve o aluno antes de gerar o link de assinatura' });
			return;
		}
		if (!activePlanIdValue) {
			toast({ status: 'warning', title: 'Selecione um plano antes de gerar o link' });
			return;
		}
		if (!billingDay || billingDay < 1 || billingDay > 31) {
			toast({ status: 'warning', title: 'Selecione o dia de vencimento (1-31)' });
			return;
		}
		setGeneratingInvite(true);
		setInviteLink('');
		try {
			const baseIds = allowPlanChange ? plans.map((plan) => plan.id) : [activePlanIdValue];
			const allowedPlanIds = Array.from(new Set([...baseIds, activePlanIdValue]));
			const payload: Record<string, any> = { studentId, planId: activePlanIdValue, allowedPlanIds, allowPlanChange };
			if (billingDay && billingDay >= 1 && billingDay <= 31) {
				payload.billingDay = billingDay;
			}
			if (discountValue && discountValue > 0) {
				payload.discount = {
					value: discountValue,
					type: 'percentage',
				};
			}
			const response = await fetch('/api/subscribe/invite/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const json = await response.json().catch(() => ({}));
			if (!response.ok || !json?.urlPath) {
				throw new Error(json?.error || 'Não foi possível gerar o link');
			}
			const base = typeof window !== 'undefined' ? window.location.origin : '';
			setInviteLink(`${base}${json.urlPath}`);
			toast({ status: 'success', title: 'Link de assinatura gerado' });
		} catch (error: any) {
			toast({ status: 'error', title: 'Erro ao gerar link', description: String(error?.message || error) });
		} finally {
			setGeneratingInvite(false);
		}
	};

	const handleWhatsappInvite = () => {
		if (!inviteLink) {
			toast({ status: 'warning', title: 'Gere o link antes de enviar pelo WhatsApp' });
			return;
		}
		const displayName = studentNameValue ? ` ${studentNameValue}` : '';
		const message = `Olá${displayName}! Segue o link para confirmar sua assinatura: ${inviteLink}`;
		if (typeof window !== 'undefined') {
			window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
		}
	};

	const handleCopyInvite = async () => {
		if (!inviteLink) {
			toast({ status: 'warning', title: 'Gere o link antes de copiar' });
			return;
		}
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(inviteLink);
				toast({ status: 'success', title: 'Link copiado' });
			}
		} catch {
			toast({ status: 'error', title: 'Falha ao copiar link' });
		}
	};

	const refreshSubscription = async () => {
		if (!studentId) return;
		const s = await fetch(`/api/students/${studentId}/subscription`, { cache: 'no-store' });
		const sj = await s.json().catch(() => ({}));
		setSubSummary(sj?.subscription || null);
	};

	return (
		<PageCard>
			<Box position="relative">
				{subLoading && (
					<Box
						position="absolute"
						top={0}
						left={0}
						right={0}
						bottom={0}
						bg="white"
						zIndex={10}
						display="flex"
						alignItems="center"
						justifyContent="center"
					>
						<Spinner size="xl" color="black" thickness="4px" />
					</Box>
				)}
				<VStack align="stretch" spacing={6}>
					<HStack>
						<Icon name='creditCard' />
						<Text fontSize="xl" fontWeight={700}>Assinatura/Plano</Text>
					</HStack>

					{mode === 'edit' && studentId && (
						<HStack spacing={4} wrap="wrap">
							<Badge colorScheme={getSubscriptionStatusColor(subSummary?.status)}>
								{subSummary?.status ? formatInvoiceStatus(subSummary.status) : 'Sem assinatura'}
							</Badge>
							{billingDayValue && (
								<Text fontSize="sm" color="gray.600">
									Dia de vencimento: {billingDayValue}
								</Text>
							)}
						</HStack>
					)}

					<VStack align="stretch" spacing={4}>
						<VStack align="stretch" spacing={3}>
							<HStack spacing={3} wrap="wrap" align="flex-end">
								<Controller name="activePlanId" control={control} render={({ field, fieldState }) => (
									<FormControl isInvalid={!!fieldState.error} isRequired maxW="280px">
										<FormLabel>Plano</FormLabel>
										<Select placeholder="Selecione um plano" {...field}>
											{plans.map((plan) => (
												<option key={plan.id} value={plan.id}>{plan.name}</option>
											))}
										</Select>
										<FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
									</FormControl>
								)} />
								<FormControl maxW="140px" isRequired>
									<FormLabel whiteSpace="nowrap">Dia de vencimento</FormLabel>
									<Select
										placeholder="Dia"
										value={billingDay}
										onChange={(e) => setBillingDay(e.target.value ? Number(e.target.value) : '')}
									>
										{Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
											<option key={day} value={day}>{day}</option>
										))}
									</Select>
								</FormControl>
								<Controller name="subscriptionDiscount" control={control} render={({ field, fieldState }) => (
									<FormControl isInvalid={!!fieldState.error} maxW="140px">
										<FormLabel whiteSpace="nowrap">Desconto (%)</FormLabel>
										<Input
											type="number"
											min={0}
											max={100}
											placeholder="0"
											{...field}
											value={field.value ?? ''}
											onChange={(e) => {
												const value = e.target.value ? Number(e.target.value) : undefined;
												if (value !== undefined && value > 100) {
													field.onChange(100);
												} else {
													field.onChange(value);
												}
											}}
										/>
										<FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
									</FormControl>
								)} />
								<Checkbox isChecked={allowPlanChange} onChange={(e) => setAllowPlanChange(e.target.checked)}>
									Permitir troca de plano pelo aluno
								</Checkbox>
							</HStack>
						</VStack>

						{plans.length === 0 ? (
							<Alert status="warning">
								<AlertIcon />
								<AlertTitle fontSize="sm">Nenhum plano sincronizado</AlertTitle>
								<AlertDescription fontSize="sm">Cadastre e sincronize um plano no Pagar.me para liberar as assinaturas.</AlertDescription>
							</Alert>
						) : selectedPlan ? (
							<VStack align="flex-start" spacing={1}>
								<Text fontSize="sm" color="gray.600">
									{discountValue && discountValue > 0 ? (
										<>
											Valor: <s>{selectedPlan.price ? currencyFormatter.format(selectedPlan.price) : '-'}</s> {currencyFormatter.format(calculateDiscountedPrice())} ({discountValue}% desc.)
										</>
									) : (
										<>
											Valor: {selectedPlan.price ? currencyFormatter.format(selectedPlan.price) : '-'}
										</>
									)}
									{selectedPlanMethods ? ` · Métodos: ${selectedPlanMethods}` : ''}
								</Text>
							</VStack>
						) : null}

						{showInvoicesTable && (
							<Box borderWidth="1px" borderRadius="lg" padding={4} marginTop={4}>
								<HStack justifyContent="space-between" marginBottom={3}>
									<Text fontSize="md" fontWeight={600}>Histórico de pagamentos</Text>
									{invoicesLoading && <Spinner size="sm" />}
								</HStack>
								<Table size="sm">
									<Thead>
										<Tr>
											<Th>Fatura</Th>
											<Th>Vencimento</Th>
											<Th>Valor</Th>
											<Th>Status</Th>
										</Tr>
									</Thead>
									<Tbody>
										{hasInvoices && invoices!.map((invoice: any) => (
											<Tr key={invoice.id}>
												<Td py={2}>{invoice.id}</Td>
												<Td py={2}>{invoice.due_at ? new Date(invoice.due_at).toLocaleDateString('pt-BR') : '-'}</Td>
												<Td py={2}>{currencyFormatter.format(((invoice.amount || 0) as number) / 100)}</Td>
												<Td py={2}>{formatInvoiceStatus(invoice.status)}</Td>
											</Tr>
										))}
										{!hasInvoices && !invoicesLoading && (
											<Tr>
												<Td colSpan={4} textAlign="center" py={4}>
													<Text fontSize="sm" color="gray.600">
														Nenhuma fatura encontrada para esta assinatura ainda.
													</Text>
												</Td>
											</Tr>
										)}
									</Tbody>
								</Table>
							</Box>
						)}

						{mode === 'new' ? (
							<Alert status="info" fontSize="sm">
								<AlertIcon />
								<AlertDescription>Salve o aluno antes de gerar o link de assinatura</AlertDescription>
							</Alert>
						) : (
							<HStack spacing={3} wrap="wrap">
								<Button
									variant="secondary"
									onClick={handleGenerateInvite}
									isLoading={generatingInvite}
									isDisabled={!activePlanIdValue || generatingInvite}
								>
									Gerar link de assinatura
								</Button>
								{mode === 'edit' && studentId && (
									<>
										<Button
											colorScheme="red"
											variant="outline"
											isLoading={subLoading}
											onClick={async () => {
												if (!studentId) return;
												try {
													const res = await fetch(`/api/students/${studentId}/subscription/cancel`, { method: 'POST' });
													const j = await res.json().catch(() => ({}));
													if (!res.ok || !j?.ok) throw new Error(j?.error || 'Falha ao cancelar');
													toast({ status: 'success', title: 'Assinatura cancelada' });
													await refreshSubscription();
												} catch (err: any) {
													toast({ status: 'error', title: 'Erro ao cancelar', description: String(err?.message || err) });
												}
											}}
											isDisabled={!subSummary}
										>
											Cancelar assinatura
										</Button>
										{String(subSummary?.status || '').toLowerCase() === 'canceled' && (
											<Button
												variant="ghost"
												isLoading={subLoading}
												onClick={async () => {
													if (!studentId) return;
													try {
														const res = await fetch(`/api/students/${studentId}/subscription/resume`, { method: 'POST' });
														const j = await res.json().catch(() => ({}));
														if (!res.ok || !j?.ok) throw new Error(j?.error || 'Falha ao retomar');
														toast({ status: 'success', title: 'Assinatura retomada' });
														await refreshSubscription();
													} catch (err: any) {
														toast({ status: 'error', title: 'Erro ao retomar', description: String(err?.message || err) });
													}
												}}
											>
												Retomar assinatura
											</Button>
										)}
									</>
								)}
								{inviteLink && (
									<>
										<Button colorScheme="green" onClick={handleWhatsappInvite}>
											Enviar via WhatsApp
										</Button>
										<Button variant="outline" onClick={handleCopyInvite}>
											Copiar link
										</Button>
									</>
								)}
							</HStack>
						)}

						{inviteLink && (
							<FormControl>
								<FormLabel>Link gerado</FormLabel>
								<Input value={inviteLink} isReadOnly />
							</FormControl>
						)}
					</VStack>
				</VStack>
			</Box>
		</PageCard>
	);
}
