"use client";
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useCallback } from 'react';
import { Icon } from '@/components/Icon';
import { Badge, Box, Button, Heading, HStack, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, FormControl, FormLabel, Select, Input, Spinner, useMediaQuery } from '@chakra-ui/react';
import PageCard from '@/components/PageCard';
import { CheckIn, exportCheckInsCsvForMonth, createCheckIn } from '@/lib/firestore';
import { collection, getDocs, query, orderBy, limit, Timestamp, doc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeText } from '@/lib/utils';

type CheckInWithStudent = CheckIn & {
  studentName?: string;
  planName?: string;
  planId?: string;
};

function computeLastNDays(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: fmt(start), end: fmt(end) };
}


export default function CheckInsPage() {
  const [checkIns, setCheckIns] = useState<CheckInWithStudent[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [manualOpen, setManualOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(()=> { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; });
  const [manualTime, setManualTime] = useState<string>(()=> new Date().toTimeString().slice(0,5));
  const [saving, setSaving] = useState(false);

  // Filtros
  const [filterStudentText, setFilterStudentText] = useState<string>('');
  const initial7 = computeLastNDays(7);
  const [filterStart, setFilterStart] = useState<string>(initial7.start);
  const [filterEnd, setFilterEnd] = useState<string>(initial7.end);
  const [preset, setPreset] = useState<string>('7');
  const [filterPlanId, setFilterPlanId] = useState<string>('');
  const [isMobile] = useMediaQuery('(max-width: 780px)');

  const loadData = useCallback(async (overrides?: { start?: string; end?: string; studentText?: string }) => {
    setLoading(true);
    try {
      // Garantir que os planos estejam carregados
      let currentPlans = plans;
      if (plans.length === 0) {
        const plansSnap = await getDocs(query(collection(db, 'plans'), orderBy('name')));
        currentPlans = plansSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setPlans(currentPlans);
      }
      const base = collection(db, 'checkins');
      const clauses: any[] = [];
      const s = overrides?.start ?? filterStart;
      const e = overrides?.end ?? filterEnd;
      if (s) {
        const d = new Date(s + 'T00:00:00');
        clauses.push(where('createdAt','>=', Timestamp.fromDate(d)));
      }
      if (e) {
        const d = new Date(e + 'T23:59:59');
        clauses.push(where('createdAt','<=', Timestamp.fromDate(d)));
      }
      const qRef = clauses.length
        ? query(base, ...clauses, orderBy('createdAt','desc'))
        : query(base, orderBy('createdAt','desc'), limit(100));

      const checkInsSnap = await getDocs(qRef);
      const checkInsRaw = checkInsSnap.docs.map(d => d.data() as CheckIn);
      const studentMap = students.length ? new Map(students.map((s: any) => [s.id, s])) : undefined;
      const checkInsData = await Promise.all(
        checkInsRaw.map(async (c) => {
          try {
            let sData: any = undefined;
            if (studentMap) {
              sData = studentMap.get(c.studentId);
            } else {
              const sSnap = await getDoc(doc(db, 'students', c.studentId));
              sData = sSnap.exists() ? (sSnap.data() as any) : null;
            }
            let planName = 'Sem plano';
            let planId: string | undefined = undefined;
            if (sData?.activePlanId && currentPlans.length > 0) {
              const plan = currentPlans.find(p => p.id === sData.activePlanId);
              planName = plan?.name || `ID: ${sData.activePlanId}`;
              planId = sData.activePlanId;
            }
            return { ...c, studentName: sData?.name || 'Aluno não encontrado', planName, planId } as CheckInWithStudent;
          } catch {
            return { ...c, studentName: 'Aluno não encontrado', planName: 'Sem plano', planId: undefined } as CheckInWithStudent;
          }
        })
      );

      const text = (overrides?.studentText ?? filterStudentText).trim();
      const filteredByName = text ? checkInsData.filter(c => normalizeText(c.studentName||'').includes(normalizeText(text))) : checkInsData;
      const selectedPlanId = filterPlanId;
      const filtered = selectedPlanId ? filteredByName.filter(c => (c as CheckInWithStudent).planId === selectedPlanId) : filteredByName;
      setCheckIns(filtered);

      // Debug: log para verificar dados
      console.log('Plans loaded:', currentPlans.length);
      console.log('CheckIns with plans:', checkInsData.slice(0, 3).map(c => ({ student: c.studentName, plan: c.planName })));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: 'Erro ao carregar dados', status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [plans, students, filterStart, filterEnd, filterStudentText, filterPlanId, toast]);


  useEffect(() => {
    loadData();
  }, [loadData]);



  useEffect(() => {
    (async () => {
      try {
        const [studentsSnap, plansSnap] = await Promise.all([
          getDocs(query(collection(db, 'students'), orderBy('name'))),
          getDocs(query(collection(db, 'plans'), orderBy('name')))
        ]);
        const studentsArr = studentsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        const plansArr = plansSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setStudents(studentsArr.filter(s => (s.active ?? true)));
        setPlans(plansArr);
      } catch (e) {
        toast({ title: 'Erro ao carregar dados', status: 'error' });
      }
    })();
  }, [toast]);


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
    setManualDate(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`);
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
    const fmt = (d: Date)=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    setFilterStart(fmt(start));
    setFilterEnd(fmt(end));
  }

  return (
    <PageCard>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between">
          <HStack>
            <Icon name="clock" />
            <Heading size="md">{isMobile ? 'Check-ins' : 'Histórico de Check-ins'}</Heading>
          </HStack>
          <HStack>
            <Button variant="secondary" leftIcon={isMobile ? undefined : <Icon name="plus" size={16} />} onClick={openManual}>
              {isMobile ? <Icon name="plus" size={16} /> : 'Adicionar'}
            </Button>
            {!isMobile && (
              <Button onClick={exportCurrentMonth} variant="outline" leftIcon={<Icon name="download" size={16} />}>
                Exportar CSV
              </Button>
            )}
          </HStack>
        </HStack>

        <Text fontWeight={700} mb={4}>Filtros</Text>
        {isMobile ? (
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Aluno</FormLabel>
              <Input placeholder="Nome do aluno" value={filterStudentText} onChange={(e)=>setFilterStudentText(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Plano</FormLabel>
              <Select placeholder="Todos os planos" value={filterPlanId} onChange={(e)=>setFilterPlanId(e.target.value)}>
                {plans.map((p:any)=>(<option key={p.id} value={p.id}>{p.name}</option>))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Data início</FormLabel>
              <Input type="date" value={filterStart} onChange={(e)=>setFilterStart(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Data fim</FormLabel>
              <Input type="date" value={filterEnd} onChange={(e)=>setFilterEnd(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Período</FormLabel>
              <Select placeholder="Customizado" value={preset} onChange={(e)=>{ const v=e.target.value; setPreset(v); if (v) applyPresetDays(parseInt(v)); }}>
                <option value="7">Últimos 7 dias</option>
                <option value="15">Últimos 15 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
              </Select>
            </FormControl>
            <HStack spacing={2} justify="flex-end">
              <Button leftIcon={<Icon name='search' size={16} />} onClick={()=>loadData()} isLoading={loading}>Buscar</Button>
              <Button variant="outline" onClick={()=>{ setFilterStudentText(''); setFilterStart(''); setFilterEnd(''); setPreset(''); setFilterPlanId(''); loadData({ start: '', end: '', studentText: '' }); }}>Limpar</Button>
            </HStack>
            <Box borderLeft="4px solid" borderColor="gray.400" pl={3} py={1}>
              <Text fontSize="lg" color="black">
                Exibindo <Text as="span" fontWeight="bold">{checkIns.length}</Text> check-ins
              </Text>
            </Box>
          </VStack>
        ) : (
          <VStack spacing={4} align="stretch">
            <HStack spacing={3} alignItems="flex-end">
              <FormControl maxW="280px">
                <FormLabel>Aluno</FormLabel>
                <Input placeholder="Nome do aluno" value={filterStudentText} onChange={(e)=>setFilterStudentText(e.target.value)} />
              </FormControl>
              <FormControl maxW="240px">
                <FormLabel>Plano</FormLabel>
                <Select placeholder="Todos os planos" value={filterPlanId} onChange={(e)=>setFilterPlanId(e.target.value)}>
                  {plans.map((p:any)=>(<option key={p.id} value={p.id}>{p.name}</option>))}
                </Select>
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
                <Button leftIcon={<Icon name='search' size={16} />} onClick={()=>loadData()} isLoading={loading}>Buscar</Button>
                <Button variant="outline" onClick={()=>{ setFilterStudentText(''); setFilterStart(''); setFilterEnd(''); setPreset(''); setFilterPlanId(''); loadData({ start: '', end: '', studentText: '' }); }}>Limpar</Button>
              </HStack>
            </HStack>
            <Box borderLeft="4px solid" borderColor="gray.400" pl={3} py={1}>
              <Text fontSize="md" color="black">
                Exibindo <Text as="span" fontWeight="bold">{checkIns.length}</Text> check-ins
              </Text>
            </Box>
          </VStack>
        )}





        {loading ? (
          <Text>Carregando...</Text>
        ) : (
          <Box overflowX="auto">
            {isMobile ? (
              <VStack spacing={3} align="stretch">
                {checkIns.map((checkIn) => {
                  const { date, time } = formatDateTime(checkIn.createdAt);
                  return (
                    <Box key={checkIn.id} borderWidth="1px" borderRadius="md" p={4}>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="700">{checkIn.studentName}</Text>
                        <HStack><Text fontSize="sm" color="gray.600">Plano:</Text><Text>{checkIn.planName}</Text></HStack>
                        <HStack><Text fontSize="sm" color="gray.600">Data:</Text><Text>{date}</Text></HStack>
                        <HStack><Text fontSize="sm" color="gray.600">Hora:</Text><Text>{time}</Text></HStack>
                        {getSourceBadge(checkIn.source)}
                      </VStack>
                    </Box>
                  );
                })}
              </VStack>
            ) : (
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Aluno</Th>
                    <Th pl={2}>Plano</Th>
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
                        <Td pl={2}>{checkIn.planName}</Td>
                        <Td>{date}</Td>
                        <Td>{time}</Td>
                        <Td>{getSourceBadge(checkIn.source)}</Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            )}

            {checkIns.length === 0 && (
              <Box textAlign="center" py={8}>
                <Text color="gray.500">Nenhum resultado encontrado</Text>
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

/* eslint-enable react-hooks/exhaustive-deps */
