"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Box, Button, Center, HStack, Input, Select, Spinner, Table, Tbody, Td, Th, Thead, Tr, VStack, useToast, Text } from '@chakra-ui/react';
import PageCard from '@/components/PageCard';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';


type User = { uid: string; email?: string; displayName?: string; role?: string };

function emailMask(v: string) { return v.replace(/\s+/g,'').toLowerCase(); }

export default function UsersPage() {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [nextToken, setNextToken] = useState<string|null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [deleteUid, setDeleteUid] = useState<string|undefined>();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const pageSize = 30;

  async function loadPage(token?: string|null) {
    setError(undefined); token ? setLoadingMore(true) : setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('pageSize', String(pageSize));
      if (token) qs.set('pageToken', token);
      const res = await fetch(`/api/users/list?${qs.toString()}`);
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body?.error || `Erro ${res.status}`); }
      const data = await res.json();
      if (token) setUsers(prev => [...prev, ...(data.users || [])]);
      else setUsers(data.users || []);
      setNextToken(data.nextPageToken || null);
    } catch (e:any) {
      if (!token) setUsers([]);
      setNextToken(null);
      setError(String(e?.message||e));
    } finally {
      token ? setLoadingMore(false) : setLoading(false);
    }
  }
  useEffect(()=>{ loadPage(null); }, []);

  const filtered = useMemo(()=>{
    return users.filter(u =>
      (!filterName || (u.displayName||'').toLowerCase().includes(filterName.toLowerCase())) &&
      (!filterEmail || (u.email||'').toLowerCase().includes(filterEmail.toLowerCase())) &&
      (!filterRole || (u.role||'')===filterRole)
    );
  }, [users, filterName, filterEmail, filterRole]);

  function labelForRole(r?: string) {
    switch (r) {
      case 'admin': return 'Administrador';
      case 'developer': return 'Desenvolvedor';
      case 'attendant': return 'Atendente';
      default: return '-';
    }
  }

  function openCreate() { router.push('/admin/users/new'); }
  function openEdit(u: User) { router.push(`/admin/users/${u.uid}/edit`); }

  async function confirmDelete() {
    if (!deleteUid) return;
    try {
      const res = await fetch('/api/users/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ uid: deleteUid }) });
      if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b?.error || `Erro ${res.status}`); }
      toast({ title:'Usuário excluído', status:'info' });
      setDeleteUid(undefined); setUsers([]); setNextToken(null); await loadPage(null);
    } catch (e:any) {
      toast({ title:'Erro ao excluir', description: String(e?.message||e), status:'error' });
    }
  }

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const el = sentinelRef.current; if (!el) return;
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry => {
        if (entry.isIntersecting && nextToken && !loadingMore) loadPage(nextToken);
      });
    });
    io.observe(el);
    return () => io.disconnect();
  }, [nextToken, loadingMore]);

  return (
    <VStack align="stretch" spacing={8}>
      <PageCard>
        <HStack justify="space-between" mb={4}>
          <HStack>
            <Icon name='user' />
            <Text fontSize="xl" fontWeight={700}>Usuários</Text>
          </HStack>
          <Button variant='secondary' leftIcon={<Icon name='plus' size={16} />} onClick={openCreate}>Adicionar</Button>
        </HStack>
        <HStack justify="space-between" mb={2}><Text fontWeight={700}>Filtros</Text></HStack>
        <HStack wrap="wrap" spacing={4}>
          <Input placeholder="Nome" value={filterName} onChange={(e)=>setFilterName(e.target.value)} maxW="220px" />
          <Input placeholder="Email" type="email" value={filterEmail} onChange={(e)=>setFilterEmail(emailMask(e.target.value))} maxW="260px" />
          <Select placeholder="Papel" value={filterRole} onChange={(e)=>setFilterRole(e.target.value)} maxW="200px">
            <option value="admin">Administrador</option>
            <option value="attendant">Atendente</option>
            <option value="developer">Desenvolvedor</option>
          </Select>
          <Button leftIcon={<Icon name='search' size={16} />} onClick={()=>{ setUsers([]); setNextToken(null); loadPage(null); }}>Buscar</Button>
          <Button variant='outline' onClick={()=>{ setFilterName(''); setFilterEmail(''); setFilterRole(''); }}>Limpar</Button>
        </HStack>

        {error && <Box color="red.500" mt={3}>{error}</Box>}

        {loading && (<Center py={12}><Spinner /></Center>)}
        {!loading && (
        <Table size="md" variant="simple" mt={5}>
          <Thead><Tr><Th>Nome</Th><Th>Email</Th><Th>Papel</Th><Th textAlign="right">Ações</Th></Tr></Thead>
          <Tbody>
            {filtered.map(u => (
              <Tr key={u.uid}>
                <Td>{u.displayName||'-'}</Td>
                <Td>{u.email||'-'}</Td>
                <Td>{labelForRole(u.role)}</Td>
                <Td textAlign="right">
                  <HStack justify="flex-end" spacing={2}>
                    <Button size="sm" leftIcon={<Icon name='edit' size={16} />} onClick={()=>openEdit(u)}>Editar</Button>
                    <Button size="sm" variant="outline" leftIcon={<Icon name='trash' size={16} />} colorScheme='red' onClick={()=>setDeleteUid(u.uid)}>Excluir</Button>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        )}
        <Box ref={sentinelRef} h="32px" />
        {loadingMore && <Center py={4}><Spinner size="sm" /></Center>}
      </PageCard>

      <AlertDialog isOpen={!!deleteUid} leastDestructiveRef={cancelRef} onClose={()=>setDeleteUid(undefined)}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Confirmar exclusão</AlertDialogHeader>
          <AlertDialogBody>Tem certeza que deseja excluir este Usuário?</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef as any} onClick={()=>setDeleteUid(undefined)}>Cancelar</Button>
            <Button colorScheme='red' ml={3} onClick={confirmDelete}>Excluir</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VStack>
  );
}
