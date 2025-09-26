"use client";

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Center,
  Grid,
  GridItem,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
  useMediaQuery,
} from '@chakra-ui/react';
import { useParams } from 'next/navigation';

import { ScheduleDoc, ScheduleEntry, getPublishedScheduleBySlug } from '@/lib/firestore';

const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABEL = new Map<number, string>([
  [1, 'Segunda'],
  [2, 'Terca'],
  [3, 'Quarta'],
  [4, 'Quinta'],
  [5, 'Sexta'],
  [6, 'Sabado'],
  [0, 'Domingo'],
]);

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default function AgendaPublicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || '';
  const [isMobile] = useMediaQuery('(max-width: 780px)');
  const [schedule, setSchedule] = useState<ScheduleDoc | null>(null);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!slug) return;
    setLoading(true);
    setError(null);
    getPublishedScheduleBySlug(slug)
      .then((response) => {
        if (!active) return;
        if (!response) {
          setError('Agenda nao encontrada ou desativada.');
          setSchedule(null);
          setEntries([]);
          return;
        }
        setSchedule(response.schedule);
        setEntries(response.entries);
      })
      .catch((err: any) => {
        if (!active) return;
        console.error(err);
        setError('Erro ao carregar os horarios. Tente novamente mais tarde.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  const timeSlots = useMemo(() => {
    const points = new Set<number>();
    entries.forEach((entry) => points.add(entry.startMinutes));
    return Array.from(points).sort((a, b) => a - b);
  }, [entries]);

  const entriesByWeekday = useMemo(() => {
    const map: Record<number, ScheduleEntry[]> = {};
    DISPLAY_WEEKDAYS.forEach((day) => { map[day] = []; });
    entries.forEach((entry) => {
      if (!map[entry.weekday]) map[entry.weekday] = [];
      map[entry.weekday].push(entry);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.startMinutes - b.startMinutes));
    return map;
  }, [entries]);

  const updatedAtLabel = useMemo(() => {
    const value: any = schedule?.updatedAt;
    if (!value || typeof value.toDate !== 'function') return '';
    const date = value.toDate() as Date;
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }, [schedule?.updatedAt]);

  return (
    <Box bg="brand.primary" minH="100vh" py={12} px={4}>
      <Box maxW="1200px" mx="auto" w="100%">
        {loading ? (
          <Center py={20}>
            <Spinner size="lg" />
          </Center>
        ) : error ? (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <VStack align="start" spacing={1}>
              <AlertTitle>Ops!</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </VStack>
          </Alert>
        ) : !schedule ? (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <AlertDescription>Agenda indisponivel no momento.</AlertDescription>
          </Alert>
        ) : (
          <VStack align="stretch" spacing={8}>
            <VStack align="stretch" spacing={2}>
              <Heading size={isMobile ? 'lg' : 'xl'}>{schedule.title || 'Agenda MUV'}</Heading>
              {schedule.description && <Text color="gray.600">{schedule.description}</Text>}
              {updatedAtLabel && <Text fontSize="sm" color="gray.500">Atualizado em {updatedAtLabel}</Text>}
            </VStack>

            {entries.length === 0 ? (
              <Center py={10}>
                <Text color="gray.500">Nenhum horario cadastrado no momento.</Text>
              </Center>
            ) : (
              <Box overflowX={isMobile ? 'auto' : 'hidden'}>
                <Grid
                  templateColumns={`100px repeat(${DISPLAY_WEEKDAYS.length}, minmax(160px, 1fr))`}
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="lg"
                  bg="white"
                  w={{ base: 'max-content', md: '100%' }}
                >
                  <GridItem
                    bg="gray.50"
                    borderRight="1px solid"
                    borderColor="gray.200"
                    px={4}
                    py={3}
                    fontWeight={700}
                  >
                    Horario
                  </GridItem>
                  {DISPLAY_WEEKDAYS.map((day) => (
                    <GridItem
                      key={`head-${day}`}
                      bg="gray.50"
                      borderRight="1px solid"
                      borderColor="gray.200"
                      px={4}
                      py={3}
                      fontWeight={700}
                    >
                      {WEEKDAY_LABEL.get(day)}
                    </GridItem>
                  ))}
                  {timeSlots.map((slot) => (
                    <Fragment key={`row-${slot}`}>
                      <GridItem
                        key={`time-${slot}`}
                        borderTop="1px solid"
                        borderColor="gray.200"
                        borderRight="1px solid"
                        px={4}
                        py={3}
                        fontWeight={600}
                        bg="gray.50"
                      >
                        {minutesToTime(slot)}
                      </GridItem>
                      {DISPLAY_WEEKDAYS.map((day) => {
                        const items = entriesByWeekday[day]?.filter((entry) => entry.startMinutes === slot) ?? [];
                        return (
                          <GridItem
                            key={`cell-${slot}-${day}`}
                            borderTop="1px solid"
                            borderRight="1px solid"
                            borderColor="gray.200"
                            px={3}
                            py={3}
                          >
                            <VStack align="stretch" spacing={3}>
                              {items.map((entry) => (
                                <Box key={entry.id} borderWidth="1px" borderColor="gray.200" borderRadius="md" p={3} bg="white" boxShadow="sm">
                                  <VStack align="stretch" spacing={2}>
                                    <Text fontWeight={700} fontSize="sm">{entry.title}</Text>
                                    <Text fontSize="xs" color="gray.500">{minutesToTime(entry.startMinutes)} - {minutesToTime(entry.endMinutes)}</Text>
                                    {entry.notes && <Text fontSize="xs" color="gray.600">{entry.notes}</Text>}
                                  </VStack>
                                </Box>
                              ))}
                            </VStack>
                          </GridItem>
                        );
                      })}
                    </Fragment>
                  ))}
                </Grid>
              </Box>
            )}
          </VStack>
        )}
      </Box>
    </Box>
  );
}


