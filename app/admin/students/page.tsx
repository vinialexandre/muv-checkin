"use client";
import PageCard from '@/components/PageCard';
import { db } from '@/lib/firebase';
import { Student } from '@/lib/firestore';
import { AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Badge, Button, Center, HStack, Input, Select, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast } from '@chakra-ui/react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type Plan = { id: string; name: string };

export default function StudentsPage() {
  const router = useRouter();
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|undefined>();
  const [deleteId, setDeleteId] = useState<string|undefined>();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // filtros
  const filterAll = 'all' as const;
  const [filterName, setFilterName] = useState('');
  const [filterPlanId, setFilterPlanId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<typeof filterAll | 'active' | 'inactive'>(filterAll);

  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (s) => {
        setStudents(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
        setError(undefined);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setStudents([]);
        setError('Permissão negada ou regras do Firestore');
        setLoading(false);
      }
    );
    getDocs(collection(db, 'plans')).then(s => setPlans(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return students.filter(s =>
      (!filterName || (s.name||'').toLowerCase().includes(filterName.toLowerCase())) &&
      (!filterPlanId || (s.activePlanId||'') === filterPlanId) &&
      (filterStatus === filterAll || (filterStatus === 'active' ? !!s.active : !s.active))
    );
  }, [students, filterName, filterPlanId, filterStatus]);

  async function removeNow() {
    if (!deleteId) return;
    await deleteDoc(doc(db, 'students', deleteId));
    setDeleteId(undefined);
    toast({ title: 'Aluno excluído', status: 'info' });
  }

  function openCreate() { router.push('/admin/students/new'); }
  function openEdit(id: string) { router.push(`/admin/students/${id}/edit`); }

  return (
    <VStack align="stretch" spacing={6}>
      <PageCard>
        <Text fontSize="lg" fontWeight={600} mb={3}>Alunos</Text>
        <HStack justify="space-between" mb={2}><Text fontWeight={600}>Filtros</Text></HStack>
        <HStack wrap="wrap" spacing={3}>
          <Input placeholder="Nome" value={filterName} onChange={(e)=>setFilterName(e.target.value)} maxW="240px" />
          <Select placeholder="Plano" value={filterPlanId} onChange={(e)=>setFilterPlanId(e.target.value)} maxW="240px">
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select placeholder="Status" value={filterStatus} onChange={(e)=>setFilterStatus((e.target.value||filterAll) as any)} maxW="180px">
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="all">Todos</option>
          </Select>
          <Button onClick={()=>{ /* no-op: filtros já aplicam em tempo real */ }}>Buscar</Button>
          <Button variant="outline" onClick={()=>{ setFilterName(''); setFilterPlanId(''); setFilterStatus(filterAll); }}>Limpar</Button>
          <Button colorScheme="blue" onClick={openCreate}>Adicionar</Button>
        </HStack>

        {loading ? (
          <Center py={10}><Spinner /></Center>
        ) : error ? (
          <Center py={6}><Text color="red.500">{error}</Text></Center>
        ) : filtered.length === 0 ? (
          <Center py={6}><Text color="gray.500">Nada encontrado</Text></Center>
        ) : (
          <Table size="sm" mt={4}>
            <Thead><Tr><Th>Nome</Th><Th>Plano</Th><Th>Status</Th><Th textAlign="right">Ações</Th></Tr></Thead>
            <Tbody>
              {filtered.map(s => (
                <Tr key={s.id}>
                  <Td>{s.name}</Td>
                  <Td>{plans.find(p => p.id === s.activePlanId)?.name || '-'}</Td>
                  <Td>{s.active ? <Badge>Ativo</Badge> : <Badge colorScheme='red'>Inativo</Badge>}</Td>
                  <Td textAlign="right">
                    <HStack justify="flex-end" spacing={2}>
                      <Button size="xs" onClick={()=>openEdit(s.id)}>Editar</Button>
                      <Button size="xs" variant="outline" colorScheme='red' onClick={()=>setDeleteId(s.id)}>Excluir</Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <AlertDialog isOpen={!!deleteId} leastDestructiveRef={cancelRef} onClose={()=>setDeleteId(undefined)}>
          <AlertDialogOverlay />
          <AlertDialogContent>
            <AlertDialogHeader>Confirmar exclusão</AlertDialogHeader>
            <AlertDialogBody>Tem certeza que deseja excluir este aluno?</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef as any} onClick={()=>setDeleteId(undefined)}>Cancelar</Button>
              <Button ml={3} colorScheme='red' onClick={removeNow}>Excluir</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageCard>
    </VStack>
  );
}

