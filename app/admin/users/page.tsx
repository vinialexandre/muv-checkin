"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Badge, Box, Button, Center, HStack, Input, Select, Spinner, Table, Tbody, Td, Th, Thead, Tr, VStack, useToast, Text, useMediaQuery, Heading } from '@chakra-ui/react';
import PageCard from '@/components/PageCard';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';


type User = { uid: string; email?: string; displayName?: string; role?: string; active?: boolean };

function emailMask(v: string) { return v.replace(/\s+/g,'').toLowerCase(); }
function isFakeEmail(v?: string) { return !!v && /@example\.invalid$/i.test(v); }
function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function UsersPage() {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [nextToken, setNextToken] = useState<string|null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftRole, setDraftRole] = useState('');
  const [draftStatus, setDraftStatus] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [deleteUid, setDeleteUid] = useState<string|undefined>();
  const [navigating, setNavigating] = useState(false);
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


	const [isMobile] = useMediaQuery('(max-width: 780px)');

  const filtered = useMemo(()=>{
    return users.filter(u => {
      const emailForFilter = isFakeEmail(u.email) ? '' : (u.email||'');
      return (
        (!filterName || normalizeText(u.displayName||'').includes(normalizeText(filterName))) &&
        (!filterEmail || emailForFilter.toLowerCase().includes(filterEmail.toLowerCase())) &&
        (!filterRole || (u.role||'')===filterRole) &&
        (!filterStatus || (filterStatus==='active' ? (u.active!==false) : (u.active===false)))
      );
    });
  }, [users, filterName, filterEmail, filterRole, filterStatus]);

  function labelForRole(r?: string) {
    switch (r) {
      case 'admin': return 'Administrador';
      case 'developer': return 'Desenvolvedor';
      case 'attendant': return 'Atendente';
      default: return '-';
    }
  }

  function openCreate() { setNavigating(true); router.push('/admin/users/new'); }
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
      {navigating && (
        <Center position="fixed" inset={0} zIndex={1000} bg="rgba(0,0,0,0.28)">
          <HStack bg="white" px={4} py={2} borderRadius="md" boxShadow="lg"><Spinner size="sm" /><Text fontWeight={600}>Carregando...</Text></HStack>
        </Center>
      )}
      <PageCard>
        <HStack justify="space-between" mb={4}>
          <HStack>
            <Icon name='user' />
            <Heading size="md">Usuários</Heading>
          </HStack>
          <Button variant='secondary' leftIcon={isMobile ? undefined : <Icon name='plus' size={16} />} onClick={openCreate}>{isMobile ? <Icon name='plus' size={16} /> : 'Adicionar'}</Button>
        </HStack>
        <HStack justify="space-between" mb={2}><Text fontWeight={700}>Filtros</Text></HStack>
        {isMobile ? (
          <VStack spacing={4} align="stretch">
            <Input placeholder="Nome" value={draftName} onChange={(e)=>setDraftName(e.target.value)} />
            <Input placeholder="Email" type="email" value={draftEmail} onChange={(e)=>setDraftEmail(emailMask(e.target.value))} />
            <Select placeholder="Papel" value={draftRole} onChange={(e)=>setDraftRole(e.target.value)}>
              <option value="admin">Administrador</option>
              <option value="attendant">Atendente</option>
              <option value="developer">Desenvolvedor</option>
            </Select>
            <Select placeholder="Status" value={draftStatus} onChange={(e)=>setDraftStatus(e.target.value)}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </Select>
            <HStack spacing={2} justify="flex-end">
              <Button leftIcon={<Icon name='search' size={16} />} onClick={()=>{ setFilterName(draftName.trim()); setFilterEmail(emailMask(draftEmail)); setFilterRole(draftRole); setFilterStatus(draftStatus); setUsers([]); setNextToken(null); loadPage(null); }}>Buscar</Button>
              <Button variant='outline' onClick={()=>{ setDraftName(''); setDraftEmail(''); setDraftRole(''); setDraftStatus(''); setFilterName(''); setFilterEmail(''); setFilterRole(''); setFilterStatus(''); }}>Limpar</Button>
            </HStack>
          </VStack>
        ) : (
          <HStack wrap="wrap" spacing={4}>
            <Input placeholder="Nome" value={draftName} onChange={(e)=>setDraftName(e.target.value)} maxW="220px" />
            <Input placeholder="Email" type="email" value={draftEmail} onChange={(e)=>setDraftEmail(emailMask(e.target.value))} maxW="260px" />
            <Select placeholder="Papel" value={draftRole} onChange={(e)=>setDraftRole(e.target.value)} maxW="200px">
              <option value="admin">Administrador</option>
              <option value="attendant">Atendente</option>
              <option value="developer">Desenvolvedor</option>
            </Select>
            <Select placeholder="Status" value={draftStatus} onChange={(e)=>setDraftStatus(e.target.value)} maxW="160px">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </Select>
            <Button leftIcon={<Icon name='search' size={16} />} onClick={()=>{ setFilterName(draftName.trim()); setFilterEmail(emailMask(draftEmail)); setFilterRole(draftRole); setFilterStatus(draftStatus); setUsers([]); setNextToken(null); loadPage(null); }}>Buscar</Button>
            <Button variant='outline' onClick={()=>{ setDraftName(''); setDraftEmail(''); setDraftRole(''); setDraftStatus(''); setFilterName(''); setFilterEmail(''); setFilterRole(''); setFilterStatus(''); }}>Limpar</Button>
          </HStack>
        )}

        {error && <Box color="red.500" mt={3}>{error}</Box>}

        {loading && (<Center py={12}><Spinner /></Center>)}
        {!loading && (
        isMobile ? (
          <VStack spacing={3} mt={5} align="stretch">
            {filtered.map(u => (
              <Box key={u.uid} borderWidth="1px" borderRadius="md" p={4}>
                <HStack justify="space-between" align="start" spacing={3}>
                  <VStack align="start" spacing={1} flex={1} minW={0}>
                    <Text fontWeight={700}>{u.displayName||'-'}</Text>
                    <Text fontSize="sm" color="gray.600" noOfLines={1}>{(!u.email || isFakeEmail(u.email)) ? 'não informado' : u.email}</Text>
                    <Text fontSize="sm" color="gray.600">Papel: {labelForRole(u.role)}</Text>
                    <Badge colorScheme={(u.active===false)?'red':'green'}>{(u.active===false)?'Inativo':'Ativo'}</Badge>
                  </VStack>
                  <HStack spacing={2} flexShrink={0}>
                    <Button size="sm" onClick={()=>openEdit(u)}><Icon name='edit' size={16} /></Button>
                    <Button size="sm" variant="outline" colorScheme='red' onClick={()=>setDeleteUid(u.uid)}><Icon name='trash' size={16} /></Button>
                  </HStack>
                </HStack>
              </Box>
            ))}
          </VStack>
        ) : (
          <Table size="md" variant="simple" mt={5}>
            <Thead><Tr><Th>Nome</Th><Th>Email</Th><Th>Papel</Th><Th>Status</Th><Th textAlign="right" pr={24}>Ações</Th></Tr></Thead>
            <Tbody>
              {filtered.map(u => (
                <Tr key={u.uid}>
                  <Td fontWeight="medium">{u.displayName||'-'}</Td>
                  <Td>{(!u.email || isFakeEmail(u.email)) ? 'não informado' : u.email}</Td>
                  <Td>{labelForRole(u.role)}</Td>
                  <Td><Badge colorScheme={(u.active===false)?'red':'green'}>{(u.active===false)?'Inativo':'Ativo'}</Badge></Td>
                  <Td textAlign="right" whiteSpace="nowrap">
                    <HStack justify="flex-end" spacing={2}>
                      <Button size="sm" leftIcon={<Icon name='edit' size={16} />} onClick={()=>openEdit(u)}>Editar</Button>
                      <Button size="sm" variant="outline" leftIcon={<Icon name='trash' size={16} />} colorScheme='red' onClick={()=>setDeleteUid(u.uid)}>Excluir</Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )
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
