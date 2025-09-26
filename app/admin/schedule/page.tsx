"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Switch,
  Text,
  Textarea,
  Tooltip,
  useClipboard,
  useDisclosure,
  useMediaQuery,
  useToast,
  VStack,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import type { Unsubscribe } from 'firebase/firestore';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';

import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';
import { db } from '@/lib/firebase';
import {
  DEFAULT_SCHEDULE_ID,
  ScheduleDoc,
  ScheduleEntry,
  deleteScheduleEntry,
  ensureSchedule,
  regenerateScheduleSlug,
  updateScheduleMeta,
  upsertScheduleEntry,
} from '@/lib/firestore';

const WEEKDAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];
const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

type EntryFormValues = {
  weekday: string;
  startTime: string;
  endTime: string;
  title: string;
  notes?: string;
};

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(value: string): number {
  const parts = value.split(':');
  if (parts.length !== 2) return Number.NaN;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.NaN;
  if (hours < 0 || hours > 23) return Number.NaN;
  if (minutes < 0 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

function weekdayLabel(value: number): string {
  return WEEKDAYS.find((w) => w.value === value)?.label ?? '';
}

export default function ScheduleAdminPage() {
  const toast = useToast();
  const [isMobile] = useMediaQuery('(max-width: 780px)');
  const [origin, setOrigin] = useState('');
  const [schedule, setSchedule] = useState<ScheduleDoc | undefined>();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [metaDraft, setMetaDraft] = useState({ title: '', description: '', published: false });
  const [savingMeta, setSavingMeta] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [slugLoading, setSlugLoading] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  const entryModal = useDisclosure();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState,
  } = useForm<EntryFormValues>({
    defaultValues: {
      weekday: '1',
      startTime: '',
      endTime: '',
      title: '',
      notes: '',
    },
  });
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    let unsubMeta: Unsubscribe | undefined;
    let unsubEntries: Unsubscribe | undefined;

    ensureSchedule().catch((err) => {
      console.error(err);
      toast({ status: 'error', title: 'Erro ao garantir agenda', description: 'Verifique suas permissoes.' });
    });

    const metaRef = doc(db, 'schedules', DEFAULT_SCHEDULE_ID);
    unsubMeta = onSnapshot(
      metaRef,
      (snap) => {
        setLoadingSchedule(false);
        if (!snap.exists()) return;
        const data = { id: snap.id, ...(snap.data() as any) } as ScheduleDoc;
        setSchedule(data);
      },
      (error) => {
        console.error(error);
        setLoadingSchedule(false);
        toast({ status: 'error', title: 'Erro ao carregar agenda', description: error.message });
      },
    );

    const entriesQuery = query(
      collection(db, 'schedules', DEFAULT_SCHEDULE_ID, 'entries'),
      orderBy('weekday'),
      orderBy('startMinutes'),
    );
    unsubEntries = onSnapshot(
      entriesQuery,
      (snap) => {
        setLoadingEntries(false);
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ScheduleEntry));
        setEntries(list);
      },
      (error) => {
        console.error(error);
        setLoadingEntries(false);
        toast({ status: 'error', title: 'Erro ao carregar eventos', description: error.message });
      },
    );

    const descriptionRows = isMobile ? 3 : 4;

  const titleField = (
    <FormControl>
      <FormLabel>Titulo exibido</FormLabel>
      <Input
        value={metaDraft.title}
        onChange={(event) => setMetaDraft((prev) => ({ ...prev, title: event.target.value }))}
        placeholder="Ex.: Horários da semana"
      />
    </FormControl>
  );

  const descriptionField = (
    <FormControl>
      <FormLabel>Descrição</FormLabel>
      <Textarea
        value={metaDraft.description}
        onChange={(event) => setMetaDraft((prev) => ({ ...prev, description: event.target.value }))}
        placeholder="Informacoes adicionais para os alunos"
        rows={descriptionRows}
      />
    </FormControl>
  );

  const publishField = (
    <FormControl display="flex" alignItems="center" justifyContent="space-between">
      <FormLabel mb={0}>Publicar agenda</FormLabel>
      <Switch
        isChecked={metaDraft.published}
        onChange={(event) => handleTogglePublished(event.target.checked)}
        isDisabled={publishing}
      />
    </FormControl>
  );

  const linkField = (
    <FormControl>
      <FormLabel>Link público</FormLabel>
      <VStack align="stretch" spacing={2}>
        <HStack>
          <Input value={publicUrl} isReadOnly placeholder="O link sera gerado automaticamente" />
          <Tooltip label={hasCopied ? 'Copiado!' : 'Copiar link'}>
            <Button onClick={onCopy} isDisabled={!publicUrl}>
              {hasCopied ? 'Copiado' : 'Copiar'}
            </Button>
          </Tooltip>
        </HStack>
        <HStack spacing={3}>
          <Button size="sm" variant="outline" onClick={handleRegenerateSlug} isLoading={slugLoading}>
            Gerar novo link
          </Button>
        </HStack>
      </VStack>
    </FormControl>
  );

  const saveButtonRow = (
    <HStack justify="flex-end">
      <Button isLoading={savingMeta} onClick={handleSaveMeta}>
        Salvar detalhes
      </Button>
    </HStack>
  );
  return () => {
      unsubMeta?.();
      unsubEntries?.();
    };
  }, [toast]);

  useEffect(() => {
    if (!schedule) return;
    setMetaDraft({
      title: schedule.title ?? '',
      description: schedule.description ?? '',
      published: !!schedule.published,
    });
  }, [schedule?.title, schedule?.description, schedule?.published]);

  const publicUrl = useMemo(() => {
    if (!origin || !schedule?.slug) return '';
    return `${origin}/agenda/${schedule.slug}`;
  }, [origin, schedule?.slug]);

  const { hasCopied, onCopy, setValue } = useClipboard(publicUrl);
  useEffect(() => {
    setValue(publicUrl);
  }, [publicUrl, setValue]);

  const timeSlots = useMemo(() => {
    const points = new Set<number>();
    entries.forEach((entry) => {
      points.add(entry.startMinutes);
    });
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

  function openCreateEntry() {
    setEditingEntry(null);
    reset({ weekday: '1', startTime: '', endTime: '', title: '', notes: '' });
    clearErrors();
    entryModal.onOpen();
  }

  function openEditEntry(entry: ScheduleEntry) {
    setEditingEntry(entry);
    reset({
      weekday: String(entry.weekday),
      startTime: minutesToTime(entry.startMinutes),
      endTime: minutesToTime(entry.endMinutes),
      title: entry.title,
      notes: entry.notes ?? '',
    });
    clearErrors();
    entryModal.onOpen();
  }

  const handleEntrySubmit = handleSubmit(async (values) => {
    const startMinutes = timeToMinutes(values.startTime);
    const endMinutes = timeToMinutes(values.endTime);
    if (Number.isNaN(startMinutes)) {
      setError('startTime', { type: 'manual', message: 'Informe um Horário valido' });
      return;
    }
    if (Number.isNaN(endMinutes)) {
      setError('endTime', { type: 'manual', message: 'Informe um Horário valido' });
      return;
    }
    if (endMinutes <= startMinutes) {
      setError('endTime', { type: 'manual', message: 'Término deve ser depois do Início' });
      return;
    }
    try {
      const trimmedNotes = values?.notes?.trim();
      await upsertScheduleEntry({
        scheduleId: schedule?.id ?? DEFAULT_SCHEDULE_ID,
        id: editingEntry?.id,
        weekday: Number(values.weekday),
        startMinutes,
        endMinutes,
        title: values.title.trim(),
        notes: trimmedNotes?.length ? trimmedNotes : null,
      });
      toast({ status: 'success', title: editingEntry ? 'Evento atualizado' : 'Evento criado' });
      entryModal.onClose();
      setEditingEntry(null);
      reset({ weekday: '1', startTime: '', endTime: '', title: '', notes: '' });
    } catch (error: any) {
      console.error(error);
      toast({ status: 'error', title: 'Erro ao salvar evento', description: error.message ?? 'Tente novamente.' });
    }
  });

  async function handleDeleteEntry() {
    if (!entryToDelete) return;
    try {
      await deleteScheduleEntry(entryToDelete.scheduleId ?? DEFAULT_SCHEDULE_ID, entryToDelete.id);
      toast({ status: 'info', title: 'Evento removido' });
    } catch (error: any) {
      console.error(error);
      toast({ status: 'error', title: 'Erro ao excluir', description: error.message ?? 'Tente novamente.' });
    } finally {
      setEntryToDelete(null);
    }
  }

  async function handleSaveMeta() {
    if (!schedule) return;
    setSavingMeta(true);
    try {
      await updateScheduleMeta({
        id: schedule.id,
        title: metaDraft.title.trim(),
        description: metaDraft.description.trim(),
      });
      toast({ status: 'success', title: 'Informacoes atualizadas' });
    } catch (error: any) {
      console.error(error);
      toast({ status: 'error', title: 'Erro ao salvar', description: error.message ?? 'Tente novamente.' });
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleTogglePublished(nextValue: boolean) {
    if (!schedule) return;
    setPublishing(true);
    setMetaDraft((prev) => ({ ...prev, published: nextValue }));
    try {
      await updateScheduleMeta({ id: schedule.id, published: nextValue });
      toast({ status: 'success', title: nextValue ? 'Agenda publicada' : 'Agenda desativada' });
    } catch (error: any) {
      console.error(error);
      setMetaDraft((prev) => ({ ...prev, published: !nextValue }));
      toast({ status: 'error', title: 'Erro ao atualizar publicacao', description: error.message ?? 'Tente novamente.' });
    } finally {
      setPublishing(false);
    }
  }

  async function handleRegenerateSlug() {
    if (!schedule) return;
    setSlugLoading(true);
    try {
      await regenerateScheduleSlug(schedule.id);
      toast({ status: 'success', title: 'Novo link gerado' });
    } catch (error: any) {
      console.error(error);
      toast({ status: 'error', title: 'Erro ao gerar link', description: error.message ?? 'Tente novamente.' });
    } finally {
      setSlugLoading(false);
    }
  }

  return (
    <VStack align="stretch" spacing={8}>
      <PageCard>
        <VStack align="stretch" spacing={6}>
          <HStack justify="space-between" flexWrap="wrap" rowGap={4}>
            <HStack spacing={3}>
              <Icon name="calendar" size={22} />
              <Heading size="md">Agenda Semanal</Heading>
            </HStack>
            <Button
              variant="secondary"
              leftIcon={!isMobile ? <Icon name="plus" size={16} /> : undefined}
              onClick={openCreateEntry}
            >
              {isMobile ? <Icon name="plus" size={18} /> : 'Novo evento'}
            </Button>
          </HStack>

          <Flex direction={isMobile ? 'column' : 'row'} gap={6}>
            <VStack align="stretch" spacing={4} flex={1}>
              <FormControl>
                <FormLabel>Titulo exibido</FormLabel>
                <Input
                  value={metaDraft.title}
                  onChange={(event) => setMetaDraft((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ex.: Horários da semana"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Descrição</FormLabel>
                <Textarea
                  value={metaDraft.description}
                  onChange={(event) => setMetaDraft((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Informacoes adicionais para os alunos"
                  rows={isMobile ? 3 : 4}
                />
              </FormControl>
              <HStack justify="flex-end">
                <Button isLoading={savingMeta} onClick={handleSaveMeta}>
                  Salvar detalhes
                </Button>
              </HStack>
            </VStack>
            <VStack align="stretch" spacing={4} flex={isMobile ? undefined : 0.9}>
              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel mb={0}>Publicar agenda</FormLabel>
                <Switch
                  isChecked={metaDraft.published}
                  onChange={(event) => handleTogglePublished(event.target.checked)}
                  isDisabled={publishing}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Link público</FormLabel>
                <HStack>
                  <Input value={publicUrl} isReadOnly placeholder="O link sera gerado automaticamente" />
                  <Tooltip label={hasCopied ? 'Copiado!' : 'Copiar link'}>
                    <Button onClick={onCopy} isDisabled={!publicUrl}>
                      {hasCopied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </Tooltip>
                </HStack>
                <HStack spacing={3} mt={2}>
                  <Button size="sm" variant="outline" onClick={handleRegenerateSlug} isLoading={slugLoading}>
                    Gerar novo link
                  </Button>
                </HStack>
              </FormControl>
            </VStack>
          </Flex>

          {!metaDraft.published && (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <AlertDescription>
                A agenda ainda nao esta publica. Ative a publicacao para compartilhar com os alunos.
              </AlertDescription>
            </Alert>
          )}

          {(loadingSchedule || loadingEntries) ? (
            <Center py={10}>
              <Spinner />
            </Center>
          ) : entries.length === 0 ? (
            <Center py={10} flexDirection="column" gap={2}>
              <Text color="gray.500">Nenhum Horário cadastrado ainda.</Text>
              <Button variant="outline" onClick={openCreateEntry}>Adicionar primeiro evento</Button>
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
                  Horário
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
                    {weekdayLabel(day)}
                  </GridItem>
                ))}
                {timeSlots.map((slot) => (
                  <Fragment key={`row-${slot}`}>
                    <GridItem
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
                          <VStack align="stretch" spacing={2}>
                            {items.map((entry) => (
                              <Box
                                key={entry.id}
                                borderWidth="1px"
                                borderColor="gray.200"
                                borderRadius="md"
                                p={3}
                                bg="white"
                                boxShadow="sm"
                              >
                                <VStack align="stretch" spacing={3}>
                                  <Box>
                                    <Text fontWeight={700} fontSize="sm">{entry.title}</Text>
                                    <Text fontSize="xs" color="gray.500">
                                      {minutesToTime(entry.startMinutes)} - {minutesToTime(entry.endMinutes)}
                                    </Text>
                                    {entry.notes && (
                                      <Text fontSize="xs" color="gray.600">{entry.notes}</Text>
                                    )}
                                  </Box>
                                  <HStack spacing={1} justify="flex-end">
                                    <Tooltip label="Editar">
                                      <IconButton
                                        size="sm"
                                        aria-label="Editar"
                                        icon={<Icon name="edit" size={16} />}
                                        onClick={() => openEditEntry(entry)}
                                      />
                                    </Tooltip>
                                    <Tooltip label="Excluir">
                                      <IconButton
                                        size="sm"
                                        aria-label="Excluir"
                                        icon={<Icon name="trash" size={16} />}
                                        colorScheme="red"
                                        variant="outline"
                                        onClick={() => setEntryToDelete(entry)}
                                      />
                                    </Tooltip>
                                  </HStack>
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
      </PageCard>

      <Modal isOpen={entryModal.isOpen} onClose={entryModal.onClose} isCentered size={isMobile ? 'full' : 'lg'}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingEntry ? 'Editar evento' : 'Novo evento'}</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleEntrySubmit}>
            <ModalBody display="flex" flexDirection="column" gap={4}>
              <FormControl isInvalid={!!formState.errors.weekday}>
                <FormLabel>Dia da semana</FormLabel>
                <Select {...register('weekday', { required: 'Selecione o dia' })}>
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </Select>
                <FormErrorMessage>{formState.errors.weekday?.message}</FormErrorMessage>
              </FormControl>
              <Flex gap={4} direction={isMobile ? 'column' : 'row'}>
                <FormControl isInvalid={!!formState.errors.startTime}>
                  <FormLabel>Início</FormLabel>
                  <Input type="time" step="300" {...register('startTime', { required: 'Informe o Horário de Início' })} />
                  <FormErrorMessage>{formState.errors.startTime?.message}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!formState.errors.endTime}>
                  <FormLabel>Término</FormLabel>
                  <Input type="time" step="300" {...register('endTime', { required: 'Informe o Horário de Término' })} />
                  <FormErrorMessage>{formState.errors.endTime?.message}</FormErrorMessage>
                </FormControl>
              </Flex>
              <FormControl isInvalid={!!formState.errors.title}>
                <FormLabel>Nome da aula ou evento</FormLabel>
                <Input {...register('title', { required: 'Informe o nome' })} placeholder="Ex.: Jiu Jitsu" />
                <FormErrorMessage>{formState.errors.title?.message}</FormErrorMessage>
              </FormControl>
              <FormControl>
                <FormLabel>Observações</FormLabel>
                <Textarea {...register('notes')} placeholder="Detalhes adicionais" rows={3} />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={() => { entryModal.onClose(); setEditingEntry(null); }}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={formState.isSubmitting}>
                {editingEntry ? 'Salvar alteracoes' : 'Adicionar evento'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={!!entryToDelete} leastDestructiveRef={deleteCancelRef} onClose={() => setEntryToDelete(null)}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Remover evento</AlertDialogHeader>
          <AlertDialogBody>Tem certeza que deseja excluir este evento da agenda?</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={deleteCancelRef} onClick={() => setEntryToDelete(null)}>Cancelar</Button>
            <Button colorScheme="red" ml={3} onClick={handleDeleteEntry}>Excluir</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VStack>
  );
}


