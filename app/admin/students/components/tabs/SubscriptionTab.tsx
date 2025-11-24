import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertIcon, AlertTitle, Badge, Box, Button, Checkbox, Divider, FormControl, FormErrorMessage, FormLabel, HStack, Input, Select, Spinner, Text, VStack, useToast } from '@chakra-ui/react';
import { Controller, Control, UseFormWatch } from 'react-hook-form';
import { Icon } from '@/components/Icon';
import PageCard from '@/components/PageCard';
import { StudentFormData } from '@/app/admin/students/formConfig';

type Plan = { id: string; name: string; price?: number; paymentMethods?: Array<'pix'|'boleto'|'credit_card'>; };

interface Props {
  mode: 'new' | 'edit';
  studentId?: string;
  control: Control<StudentFormData>;
  watch: UseFormWatch<StudentFormData>;
  plans: Plan[];
  currencyFormatter: Intl.NumberFormat;
  studentNameValue: string;
}

const formatPaymentMethod = (method: 'pix'|'boleto'|'credit_card') => {
  switch (method) {
    case 'pix': return 'Pix';
    case 'boleto': return 'Boleto';
    case 'credit_card': return 'Cartão';
    default: return method;
  }
};

export default function SubscriptionTab({ mode, studentId, control, watch, plans, currencyFormatter, studentNameValue }: Props) {
  const toast = useToast();
  const [allowPlanChange, setAllowPlanChange] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [subSummary, setSubSummary] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [newPlanId, setNewPlanId] = useState<string>('');
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesSize] = useState(10);

  const activePlanIdValue = watch('activePlanId');
  const selectedPlan = plans.find((plan) => plan.id === activePlanIdValue);
  const selectedPlanMethods = selectedPlan?.paymentMethods?.map((method) => formatPaymentMethod(method)).join(' · ');

  useEffect(() => {
    setNewPlanId(activePlanIdValue || '');
  }, [activePlanIdValue]);

  useEffect(() => {
    if (!studentId || mode !== 'edit') return;
    let cancelled = false;
    (async () => {
      try {
        setSubLoading(true);
        const s = await fetch(`/api/students/${studentId}/subscription`, { cache: 'no-store' });
        const sj = await s.json().catch(() => ({}));
        if (!cancelled) setSubSummary(sj?.subscription || null);
      } catch {}
      finally {
        if (!cancelled) setSubLoading(false);
      }
    })();
    (async () => {
      try {
        setInvoicesLoading(true);
        const r = await fetch(`/api/students/${studentId}/subscription/invoices?page=${invoicesPage}&size=${invoicesSize}`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!cancelled) setInvoices(Array.isArray(j?.invoices) ? j.invoices : []);
      } catch {}
      finally {
        if (!cancelled) setInvoicesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, mode, invoicesPage, invoicesSize]);

  const handleGenerateInvite = async () => {
    if (mode === 'new' || !studentId) {
      toast({ status: 'warning', title: 'Salve o aluno antes de gerar o link de assinatura' });
      return;
    }
    if (!activePlanIdValue) {
      toast({ status: 'warning', title: 'Selecione um plano antes de gerar o link' });
      return;
    }
    setGeneratingInvite(true);
    setInviteLink('');
    try {
      const baseIds = allowPlanChange ? plans.map((plan) => plan.id) : [activePlanIdValue];
      const allowedPlanIds = Array.from(new Set([...baseIds, activePlanIdValue]));
      const response = await fetch('/api/subscribe/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, planId: activePlanIdValue, allowedPlanIds, allowPlanChange })
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
    const r2 = await fetch(`/api/students/${studentId}/subscription/invoices?page=${invoicesPage}&size=${invoicesSize}`, { cache: 'no-store' });
    const j2 = await r2.json().catch(() => ({}));
    setInvoices(Array.isArray(j2?.invoices) ? j2.invoices : []);
  };

  return (
    <PageCard>
      <VStack align="stretch" spacing={6}>
        <HStack>
          <Icon name='creditCard' />
          <Text fontSize="xl" fontWeight={700}>Assinatura/Plano</Text>
        </HStack>

        {mode === 'edit' && studentId && (
          <>
            <VStack align="stretch" spacing={4}>
              <HStack spacing={4} wrap="wrap">
                <Badge colorScheme={String(subSummary?.status || '').toLowerCase() === 'canceled' ? 'red' : 'green'}>
                  {subSummary?.status || 'Sem assinatura'}
                </Badge>
                <Text>{subSummary?.plan?.name || '-'}</Text>
              </HStack>
              {!subSummary && (
                <Text fontSize="sm" color="gray.600">
                  Esse aluno ainda não possui assinatura ativa. Gere o link de assinatura abaixo para que ele contrate um plano.
                </Text>
              )}
              <HStack spacing={3} wrap="wrap">
                <Select maxW="280px" placeholder="Selecionar plano" value={newPlanId} onChange={(e) => setNewPlanId(e.target.value)}>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </Select>
                <Button
                  isLoading={subLoading}
                  onClick={async () => {
                    if (!studentId || !newPlanId) return;
                    try {
                      const res = await fetch(`/api/students/${studentId}/subscription/change-plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPlanId }) });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Falha na troca de plano');
                      toast({ status: 'success', title: 'Plano atualizado' });
                      await refreshSubscription();
                    } catch (err: any) {
                      toast({ status: 'error', title: 'Erro ao trocar plano', description: String(err?.message || err) });
                    }
                  }}
                  isDisabled={!newPlanId || !subSummary}
                >
                  Aplicar
                </Button>
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
              </HStack>
            </VStack>
            <Divider />
          </>
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
              )}/>
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
            <Text fontSize="sm" color="gray.600">
              Valor: {selectedPlan.price ? currencyFormatter.format(selectedPlan.price) : '-'}
              {selectedPlanMethods ? ` · Métodos: ${selectedPlanMethods}` : ''}
            </Text>
          ) : null}
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

        {mode === 'edit' && studentId && (
          <>
            <Divider />
            <VStack align="stretch" spacing={3}>
              <HStack>
                <Icon name="creditCard" />
                <Text fontWeight={600}>Histórico de pagamento</Text>
              </HStack>
              {invoicesLoading ? (
                <HStack><Spinner size="sm" /><Text>Carregando...</Text></HStack>
              ) : (
                <>
                  <Box overflowX="auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Fatura</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Criada</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Vencimento</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Valor</th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv: any) => (
                          <tr key={inv.id}>
                            <td style={{ padding: '6px' }}>{inv.id}</td>
                            <td style={{ padding: '6px' }}>{inv.created_at || '-'}</td>
                            <td style={{ padding: '6px' }}>{inv.due_at || '-'}</td>
                            <td style={{ padding: '6px' }}>{typeof inv.amount === 'number' ? currencyFormatter.format(inv.amount / 100) : '-'}</td>
                            <td style={{ padding: '6px' }}>{inv.status || '-'}</td>
                          </tr>
                        ))}
                        {invoices.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: '6px' }}>Sem faturas</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Box>
                  <HStack justify="space-between" mt={2}>
                    <Button size="sm" onClick={() => setInvoicesPage((p) => Math.max(1, p - 1))} isDisabled={invoicesLoading || invoicesPage <= 1}>
                      Anterior
                    </Button>
                    <Text fontSize="sm">Página {invoicesPage}</Text>
                    <Button size="sm" onClick={() => setInvoicesPage((p) => p + 1)} isDisabled={invoicesLoading || invoices.length < invoicesSize}>
                      Próxima
                    </Button>
                  </HStack>
                </>
              )}
            </VStack>
          </>
        )}
      </VStack>
    </PageCard>
  );
}
