"use client";
import { db } from '@/lib/firebase';
import { AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Button, Center, HStack, Input, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast } from '@chakra-ui/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageCard from '@/components/PageCard';

import { Icon } from '@/components/Icon';

type Plan = { id: string; name: string; price: number };

export default function PlansPage() {
  const toast = useToast();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filterName, setFilterName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|undefined>();
  const [deleteId, setDeleteId] = useState<string|undefined>();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'plans'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (s) => {
        setPlans(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
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

  const filtered = useMemo(() => plans.filter(p => !filterName || p.name.toLowerCase().includes(filterName.toLowerCase())), [plans, filterName]);

  async function removeNow() {
    if (!deleteId) return;
    await deleteDoc(doc(db, 'plans', deleteId));
    setDeleteId(undefined);
    toast({ title: 'Plano excluído', status: 'info' });
  }

  return (
    <VStack align="stretch" spacing={8}>
      <PageCard>
        <HStack justify="space-between" mb={4}>
          <HStack>
            <Icon name='folder' />
            <Text fontSize="xl" fontWeight={700}>Planos</Text>
          </HStack>
          <Button variant="secondary" leftIcon={<Icon name='plus' size={16} />} onClick={() => router.push('/admin/plans/new')}>Adicionar</Button>
        </HStack>
        <HStack justify="space-between" mb={2}><Text fontWeight={700}>Filtros</Text></HStack>
        <HStack spacing={4} wrap="wrap">
          <Input placeholder="Nome" value={filterName} onChange={(e) => setFilterName(e.target.value)} maxW="240px" />
          <Button leftIcon={<Icon name='search' size={16} />} onClick={() => {}}>Buscar</Button>
          <Button variant="outline" onClick={()=>setFilterName('')}>Limpar</Button>
        </HStack>

        {loading ? (
          <Center py={10}><Spinner /></Center>
        ) : error ? (
          <Center py={6}><Text color="red.500">{error}</Text></Center>
        ) : filtered.length === 0 ? (
          <Center py={6}><Text color="gray.500">Nada encontrado</Text></Center>
        ) : (
          <Table size="md" mt={5}>
            <Thead><Tr><Th>Nome</Th><Th>Preço</Th><Th textAlign="right">Ações</Th></Tr></Thead>
            <Tbody>
              {filtered.map(p => (
                <Tr key={p.id}>
                  <Td>{p.name}</Td>
                  <Td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price || 0)}</Td>
                  <Td textAlign="right">
                    <HStack justify="flex-end" spacing={2}>
                      <Button size="sm" leftIcon={<Icon name='edit' size={16} />} as={Link} href={`/admin/plans/${p.id}/edit` as any}>Editar</Button>
                      <Button size="sm" variant="outline" leftIcon={<Icon name='trash' size={16} />} colorScheme='red' onClick={() => setDeleteId(p.id)}>Excluir</Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
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

