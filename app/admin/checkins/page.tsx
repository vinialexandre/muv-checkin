"use client";
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Badge, Box, Button, Heading, HStack, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast } from '@chakra-ui/react';
import PageCard from '@/components/PageCard';
import { CheckIn, getRecentCheckIns, exportCheckInsCsvForMonth } from '@/lib/firestore';
import { collection, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type CheckInWithStudent = CheckIn & {
  studentName?: string;
};

export default function CheckInsPage() {
  const [checkIns, setCheckIns] = useState<CheckInWithStudent[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Carrega estudantes
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentsData = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsData);

      // Carrega check-ins recentes (últimos 100)
      const checkInsQuery = query(
        collection(db, 'checkins'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const checkInsSnap = await getDocs(checkInsQuery);
      const checkInsData = checkInsSnap.docs.map(doc => {
        const data = doc.data() as CheckIn;
        const student = studentsData.find(s => s.id === data.studentId);
        return {
          ...data,
          studentName: student?.name || 'Aluno não encontrado'
        };
      });

      setCheckIns(checkInsData);
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

  return (
    <PageCard>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between">
          <HStack>
            <Icon name="clock" />
            <Heading size="lg">Histórico de Check-ins</Heading>
          </HStack>
          <HStack>
            <Button onClick={loadData} variant="outline" size="sm" isLoading={loading}>
              Atualizar
            </Button>
            <Button onClick={exportCurrentMonth} variant="secondary" size="sm">
              Exportar CSV (Mês Atual)
            </Button>
          </HStack>
        </HStack>

        <Text color="gray.700">
          Histórico dos últimos 100 check-ins realizados no sistema.
        </Text>

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
                  <Th>ID</Th>
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
                      <Td fontSize="sm" color="gray.500">{checkIn.id}</Td>
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
    </PageCard>
  );
}
