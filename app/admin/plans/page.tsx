"use client";
import { db } from '@/lib/firebase';
import { AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Badge, Button, Center, HStack, Input, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast, Box, useMediaQuery, Heading } from '@chakra-ui/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageCard from '@/components/PageCard';

import { Icon } from '@/components/Icon';
import { Plan, PlanBillingInterval, PlanPaymentMethod, PlanSyncStatus } from '@/lib/firestore';

function labelInterval(interval?: PlanBillingInterval, count?: number, cycles?: number) {
  if (!interval || !count) return '-';
  const intervalLabel = {
    day: 'dia(s)',
    week: 'semana(s)',
    month: 'mês(es)',
    year: 'ano(s)',
  }[interval];
  const base = `A cada ${count} ${intervalLabel}`;
  if (cycles && cycles > 0) return `${base} · ${cycles} ciclo(s)`;
  return base;
}

function labelPaymentMethods(methods?: PlanPaymentMethod[]) {
  if (!methods || !methods.length) return '-';
  return methods.map((m) => {
    switch (m) {
      case 'credit_card': return 'Cartão';
      case 'pix': return 'Pix';
      case 'boleto': return 'Boleto';
      default: return m;
    }
  }).join(' · ');
}

function syncBadge(status?: PlanSyncStatus) {
  switch (status) {
    case 'synced':
      return { label: 'Sincronizado', scheme: 'green' as const };
    case 'error':
      return { label: 'Erro', scheme: 'red' as const };
    case 'pending':
    default:
      return { label: 'Pendente', scheme: 'yellow' as const };
  }
}

export default function PlansPage() {
  const toast = useToast();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filterName, setFilterName] = useState('');
  const [draftName, setDraftName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|undefined>();
  const [deleteId, setDeleteId] = useState<string|undefined>();
  const [navigating, setNavigating] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [displayCount, setDisplayCount] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'plans'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (s) => {
        setPlans(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Plan[]);
        setError(undefined);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setPlans([]);
        setError('Permissão negada ou regras do Firestore');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const [isMobile] = useMediaQuery('(max-width: 780px)');

  const filtered = useMemo(() => plans.filter(p => !filterName || p.name.toLowerCase().includes(filterName.toLowerCase())), [plans, filterName]);

  const displayedPlans = useMemo(() => filtered.slice(0, displayCount), [filtered, displayCount]);

  const hasMore = displayCount < filtered.length;

  useEffect(() => {
    setDisplayCount(10);
  }, [filterName]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000 && hasMore && !loadingMore) {
        setLoadingMore(true);
        setTimeout(() => {
          setDisplayCount(prev => prev + 10);
          setLoadingMore(false);
        }, 500);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore]);


  async function syncPlan(planId: string) {
    try {
      setSyncingId(planId);
      const res = await fetch(`/api/plans/${planId}/sync`, { method: 'POST' });
      const json = await res.json().catch(() => undefined);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Falha ao sincronizar plano');
      }
      toast({ title: 'Plano sincronizado', status: 'success' });
    } catch (e: any) {
      toast({ title: 'Erro ao sincronizar', description: String(e?.message || e), status: 'error' });
    } finally {
      setSyncingId(null);
    }
  }

  async function removeNow() {
    if (!deleteId) return;
    await deleteDoc(doc(db, 'plans', deleteId));
    setDeleteId(undefined);
    toast({ title: 'Plano excluído', status: 'info' });
  }

  return (
    <VStack align="stretch" spacing={8}>
      {navigating && (
        <Center position="fixed" inset={0} zIndex={1000} bg="rgba(0,0,0,0.28)">
          <HStack bg="white" px={4} py={2} borderRadius="md" boxShadow="lg"><Spinner size="sm" /><Text fontWeight={600}>Carregando...</Text></HStack>
        </Center>
      )}
      <PageCard>
        <HStack justify="space-between" mb={4}>
          <HStack>
            <Icon name='folder' />
            <Heading size="md">Planos</Heading>
          </HStack>
          <Button variant="secondary" leftIcon={isMobile ? undefined : <Icon name='plus' size={16} />} onClick={() => { setNavigating(true); router.push('/admin/plans/new'); }}>{isMobile ? <Icon name='plus' size={16} /> : 'Adicionar'}</Button>
        </HStack>
        <HStack justify="space-between" mb={2}><Text fontWeight={700}>Filtros</Text></HStack>
        {isMobile ? (
          <VStack spacing={4} align="stretch">
            <Input placeholder="Nome" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            <HStack spacing={2} justify="flex-end">
              <Button leftIcon={<Icon name='search' size={16} />} onClick={() => { setFilterName(draftName.trim()); }}>Buscar</Button>
              <Button variant="outline" onClick={()=>{ setDraftName(''); setFilterName(''); }}>Limpar</Button>
            </HStack>
          </VStack>
        ) : (
          <HStack spacing={4} wrap="wrap">
            <Input placeholder="Nome" value={draftName} onChange={(e) => setDraftName(e.target.value)} maxW="240px" />
            <Button leftIcon={<Icon name='search' size={16} />} onClick={() => { setFilterName(draftName.trim()); }}>Buscar</Button>
            <Button variant="outline" onClick={()=>{ setDraftName(''); setFilterName(''); }}>Limpar</Button>
          </HStack>
        )}

        {loading ? (
          <Center py={10}><Spinner /></Center>
        ) : error ? (
          <Center py={6}><Text color="red.500">{error}</Text></Center>
        ) : filtered.length === 0 ? (
          <Center py={6}><Text color="gray.500">Nada encontrado</Text></Center>
        ) : (
          isMobile ? (
            <VStack spacing={3} mt={5} align="stretch">
              {displayedPlans.map(p => {
                const sync = syncBadge(p.planSyncStatus as PlanSyncStatus | undefined);
                return (
                  <Box key={p.id} borderWidth="1px" borderRadius="md" p={4}>
                    <VStack align="stretch" spacing={2}>
                      <Text fontWeight={700}>{p.name}</Text>
                      <Text fontSize="sm" color="gray.600">Cobrança: {labelInterval(p.billingInterval as PlanBillingInterval | undefined, p.billingIntervalCount as number | undefined, p.billingCycles as number | undefined)}</Text>
                      <Text fontSize="sm" color="gray.600">Métodos: {labelPaymentMethods(p.paymentMethods as PlanPaymentMethod[] | undefined)}</Text>
                      <Text fontSize="sm" color="gray.600">Preço: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price || 0)}</Text>
                      <HStack spacing={2}>
                        <Badge colorScheme={(p.active===false)?'red':'green'}>{(p.active===false)?'Inativo':'Ativo'}</Badge>
                        <Badge colorScheme={sync.scheme}>{sync.label}</Badge>
                      </HStack>
                    </VStack>
                    <HStack spacing={2} justify="flex-end" mt={3}>
                      <Button size="sm" variant="outline" onClick={() => syncPlan(p.id)} isLoading={syncingId === p.id} isDisabled={!!syncingId && syncingId !== p.id}>
                        <Icon name='refresh' size={16} />
                      </Button>
                      <Button size="sm" as={Link} href={`/admin/plans/${p.id}/edit` as any}><Icon name='edit' size={16} /></Button>
                      <Button size="sm" variant="outline" colorScheme='red' onClick={() => setDeleteId(p.id)}><Icon name='trash' size={16} /></Button>
                    </HStack>
                  </Box>
                );
              })}
              {loadingMore && <Center py={4}><Spinner size="sm" /></Center>}
            </VStack>
          ) : (
            <>
              <Table size="md" mt={5}>
                <Thead>
                  <Tr>
                    <Th>Nome</Th>
                    <Th>Preço</Th>
                    <Th>Cobrança</Th>
                    <Th>Métodos</Th>
                    <Th>Status</Th>
                    <Th>Sync</Th>
                    <Th textAlign="right" pr={24}>Ações</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {displayedPlans.map(p => {
                    const sync = syncBadge(p.planSyncStatus as PlanSyncStatus | undefined);
                    return (
                      <Tr key={p.id}>
                        <Td>{p.name}</Td>
                        <Td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price || 0)}</Td>
                        <Td>{labelInterval(p.billingInterval as PlanBillingInterval | undefined, p.billingIntervalCount as number | undefined, p.billingCycles as number | undefined)}</Td>
                        <Td>{labelPaymentMethods(p.paymentMethods as PlanPaymentMethod[] | undefined)}</Td>
                        <Td><Badge colorScheme={(p.active===false)?'red':'green'}>{(p.active===false)?'Inativo':'Ativo'}</Badge></Td>
                        <Td><Badge colorScheme={sync.scheme}>{sync.label}</Badge></Td>
                        <Td textAlign="right">
                          <HStack justify="flex-end" spacing={2}>
                            <Button size="sm" variant="outline" leftIcon={<Icon name='refresh' size={16} />} onClick={() => syncPlan(p.id)} isLoading={syncingId === p.id} isDisabled={!!syncingId && syncingId !== p.id}>Pagar.me</Button>
                            <Button size="sm" leftIcon={<Icon name='edit' size={16} />} as={Link} href={`/admin/plans/${p.id}/edit` as any}>Editar</Button>
                            <Button size="sm" variant="outline" leftIcon={<Icon name='trash' size={16} />} colorScheme='red' onClick={() => setDeleteId(p.id)}>Excluir</Button>
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
              {loadingMore && <Center py={4}><Spinner size="sm" /></Center>}
            </>
          )
        )}

        <AlertDialog isOpen={!!deleteId} leastDestructiveRef={cancelRef} onClose={() => setDeleteId(undefined)}>
          <AlertDialogOverlay />
          <AlertDialogContent>
            <AlertDialogHeader>Confirmar exclusão</AlertDialogHeader>
            <AlertDialogBody>Tem certeza que deseja excluir este plano?</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef as any} onClick={() => setDeleteId(undefined)}>Cancelar</Button>
              <Button ml={3} colorScheme='red' onClick={removeNow}>Excluir</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageCard>
    </VStack>
  );
}
