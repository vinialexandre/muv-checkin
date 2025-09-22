"use client";
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Badge, Box, Button, Heading, HStack, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, FormControl, FormLabel, Select, Input, Spinner } from '@chakra-ui/react';
import PageCard from '@/components/PageCard';
import { CheckIn, exportCheckInsCsvForMonth, createCheckIn } from '@/lib/firestore';
import { collection, getDocs, query, orderBy, limit, Timestamp, doc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type CheckInWithStudent = CheckIn & {
  studentName?: string;
};

function computeLastNDays(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}


export default function CheckInsPage() {
  const [checkIns, setCheckIns] = useState<CheckInWithStudent[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [manualOpen, setManualOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [manualTime, setManualTime] = useState<string>(()=> new Date().toTimeString().slice(0,5));
  const [saving, setSaving] = useState(false);

  // Filtros
  const [filterStudentText, setFilterStudentText] = useState<string>('');
  const initial7 = computeLastNDays(7);
  const [filterStart, setFilterStart] = useState<string>(initial7.start);
  const [filterEnd, setFilterEnd] = useState<string>(initial7.end);
  const [preset, setPreset] = useState<string>('7');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snaps = await getDocs(query(collection(db, 'students'), orderBy('name')));
        const arr = snaps.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setStudents(arr.filter(s => (s.active ?? true)));
      } catch (e) {
        toast({ title: 'Erro ao carregar alunos', status: 'error' });
      }
    })();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const base = collection(db, 'checkins');
      const clauses: any[] = [];
      if (filterStart) {
        const d = new Date(filterStart + 'T00:00:00');
        clauses.push(where('createdAt','>=', Timestamp.fromDate(d)));
      }
      if (filterEnd) {
        const d = new Date(filterEnd + 'T23:59:59');
        clauses.push(where('createdAt','<=', Timestamp.fromDate(d)));
      }
      const qRef = clauses.length
        ? query(base, ...clauses, orderBy('createdAt','desc'))
        : query(base, orderBy('createdAt','desc'), limit(100));

      const checkInsSnap = await getDocs(qRef);
      const checkInsRaw = checkInsSnap.docs.map(d => d.data() as CheckIn);
      const checkInsData = await Promise.all(
        checkInsRaw.map(async (c) => {
          try {
            const sSnap = await getDoc(doc(db, 'students', c.studentId));
            const sData = sSnap.exists() ? (sSnap.data() as any) : null;
            return { ...c, studentName: sData?.name || 'Aluno não encontrado' } as CheckInWithStudent;
          } catch {
            return { ...c, studentName: 'Aluno não encontrado' } as CheckInWithStudent;
          }
        })
      );

      const text = filterStudentText.trim().toLowerCase();
      const filteredByName = text ? checkInsData.filter(c => (c.studentName||'').toLowerCase().includes(text)) : checkInsData;
      setCheckIns(filteredByName);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: 'Erro ao carregar dados', status: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function exportCurrentMonth() {
    try {
      const now = new Date();
      const csv = await exportCheckInsCsvForMonth(now.getFullYear(), now.getMonth());
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checkins-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Arquivo exportado com sucesso', status: 'success' });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ title: 'Erro ao exportar dados', status: 'error' });
    }
  }


  function openManual() {
    setManualStudentId('');
    const now = new Date();
    setManualDate(now.toISOString().slice(0,10));
    setManualTime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    setManualOpen(true);
  }

  async function saveManual() {
    if (!manualStudentId) { toast({ title: 'Selecione um aluno', status: 'warning' }); return; }
    try {
      setSaving(true);
      const [y,m,d] = manualDate.split('-').map(Number);
      const [hh,mm] = manualTime.split(':').map(Number);
      const when = new Date(y, (m||1)-1, d||1, hh||0, mm||0, 0);

      // Pré-validação: impedir duplicidade no mesmo dia
      const yyyymmdd = `${String(when.getFullYear())}${String(when.getMonth()+1).padStart(2,'0')}${String(when.getDate()).padStart(2,'0')}`;
      const lockRef = doc(db, 'checkins_daily', `${manualStudentId}_${yyyymmdd}`);
      const lockSnap = await getDoc(lockRef);
      if (lockSnap.exists()) {
        toast({ title: 'Já existe check-in neste dia para este aluno', status: 'info' });
        return;
      }

      const res = await createCheckIn({ studentId: manualStudentId, when, source: 'manual' });
      toast({ title: res.created ? 'Check-in criado' : 'Check-in já registrado hoje', status: res.created ? 'success' : 'info' });
      setManualOpen(false);
      await loadData();
    } catch (e:any) {
      toast({ title: 'Erro ao criar check-in', description: String(e?.message||e), status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function formatDateTime(timestamp: Timestamp) {
    const date = timestamp.toDate();
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR')
    };
  }

  function getSourceBadge(source: 'face' | 'manual') {
    return source === 'face'
      ? <Badge colorScheme="blue">Facial</Badge>
      : <Badge colorScheme="gray">Manual</Badge>;
  }

  function applyPresetDays(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days-1));
    const fmt = (d: Date)=> d.toISOString().slice(0,10);
    setFilterStart(fmt(start));
    setFilterEnd(fmt(end));
  }

  return (
    <PageCard>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between">
          <HStack>
            <Icon name="clock" />
            <Heading size="lg">Histórico de Check-ins</Heading>
          </HStack>
          <HStack>
            <Button size="sm" leftIcon={<Icon name="plus" size={16} />} onClick={openManual}>
              Adicionar
            </Button>
            <Button onClick={loadData} variant="outline" size="sm" isLoading={loading}>
              Atualizar
            </Button>
            <Button onClick={exportCurrentMonth} variant="secondary" size="sm">
              Exportar CSV (Mês Atual)
            </Button>
          </HStack>
        </HStack>

        <HStack justify="space-between" mb={1}><Text fontWeight={700}>Filtros</Text></HStack>
        <HStack spacing={3} alignItems="flex-end">
          <FormControl maxW="280px">
            <FormLabel>Aluno</FormLabel>
            <Input placeholder="Nome do aluno" value={filterStudentText} onChange={(e)=>setFilterStudentText(e.target.value)} />
          </FormControl>
          <FormControl>
            <FormLabel>Data início</FormLabel>
            <Input type="date" value={filterStart} onChange={(e)=>setFilterStart(e.target.value)} />
          </FormControl>
          <FormControl>
            <FormLabel>Data fim</FormLabel>
            <Input type="date" value={filterEnd} onChange={(e)=>setFilterEnd(e.target.value)} />
          </FormControl>
          <FormControl maxW="220px">
            <FormLabel>Período</FormLabel>
            <Select placeholder="Customizado" value={preset} onChange={(e)=>{ const v=e.target.value; setPreset(v); if (v) applyPresetDays(parseInt(v)); }}>
              <option value="7">Últimos 7 dias</option>
              <option value="15">Últimos 15 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </Select>
          </FormControl>
          <HStack>
            <Button leftIcon={<Icon name='search' size={16} />} onClick={loadData} isLoading={loading}>Buscar</Button>
            <Button variant="outline" onClick={()=>{ const last7 = computeLastNDays(7); setFilterStudentText(''); setFilterStart(last7.start); setFilterEnd(last7.end); setPreset('7'); loadData(); }}>Limpar</Button>
          </HStack>
        </HStack>

        {loading ? (
          <Text>Carregando...</Text>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Aluno</Th>
                  <Th>Data</Th>
                  <Th>Horário</Th>
                  <Th>Tipo</Th>
                </Tr>
              </Thead>
              <Tbody>
                {checkIns.map((checkIn) => {
                  const { date, time } = formatDateTime(checkIn.createdAt);
                  return (
                    <Tr key={checkIn.id}>
                      <Td fontWeight="medium">{checkIn.studentName}</Td>
                      <Td>{date}</Td>
                      <Td>{time}</Td>
                      <Td>{getSourceBadge(checkIn.source)}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>

            {checkIns.length === 0 && (
              <Box textAlign="center" py={8}>
                <Text color="gray.500">Nenhum check-in encontrado</Text>
              </Box>

            )}
          </Box>
        )}
      </VStack>
      <Modal isOpen={manualOpen} onClose={()=>{ if (!saving) setManualOpen(false); }} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Novo check-in manual</ModalHeader>
          <ModalCloseButton isDisabled={saving} />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired>
                <FormLabel>Aluno</FormLabel>
                <Select placeholder="Selecione um aluno" value={manualStudentId} onChange={(e)=>setManualStudentId(e.target.value)}>
                  {students.map((s:any)=>(<option key={s.id} value={s.id}>{s.name}</option>))}
                </Select>
              </FormControl>
              <HStack>
                <FormControl isRequired>
                  <FormLabel>Data</FormLabel>
                  <Input type="date" value={manualDate} onChange={(e)=>setManualDate(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Hora</FormLabel>
                  <Input type="time" value={manualTime} onChange={(e)=>setManualTime(e.target.value)} />
                </FormControl>
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={()=>setManualOpen(false)} isDisabled={saving}>Cancelar</Button>
              <Button onClick={saveManual} isLoading={saving} isDisabled={!manualStudentId}>Salvar</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </PageCard>
  );
}
