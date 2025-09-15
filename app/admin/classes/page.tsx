"use client";
import { db } from '@/lib/firebase';
import { AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Button, Center, FormControl, FormErrorMessage, HStack, Input, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast } from '@chakra-ui/react';
import { Timestamp, addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageCard from '@/components/PageCard';
import * as yup from 'yup';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

type ClassDoc = { id: string; modality: string; startsAt: Timestamp; endsAt: Timestamp };

const schema = yup.object({
  modality: yup.string().trim().min(2,'Modalidade muito curta').required('Modalidade obrigatória'),
  date: yup.string().required('Data obrigatória'), // yyyy-mm-dd
});
type FormData = yup.InferType<typeof schema>;

export default function ClassesPage() {
  const toast = useToast();
  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [filterMod, setFilterMod] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string|undefined>();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { control, handleSubmit, formState:{ errors, isValid, isSubmitting }, reset } = useForm<FormData>({
    mode:'onBlur', reValidateMode:'onBlur', resolver: yupResolver(schema), defaultValues:{ modality:'', date:'' }
  });

  useEffect(()=>{
    const unsub = onSnapshot(query(collection(db,'classes'), orderBy('startsAt','desc')), s => setClasses(s.docs.map(d=>({ id:d.id, ...(d.data() as any) }))));
    setLoading(false); return () => unsub();
  },[]);

  const filtered = useMemo(()=> classes.filter(c => (
    (!filterMod || c.modality.toLowerCase().includes(filterMod.toLowerCase())) &&
    (!filterDate || (c.startsAt as any).toDate().toISOString().slice(0,10) === filterDate)
  )), [classes, filterMod, filterDate]);

  const add = handleSubmit(async (data)=>{
    const d = new Date(data.date + 'T00:00:00');
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    await addDoc(collection(db,'classes'), { modality: data.modality, startsAt: Timestamp.fromDate(start), endsAt: Timestamp.fromDate(end), roster: [] });
    toast({ title:'Aula salva', status:'success' });
    reset({ modality:'', date:'' });
  });

  async function removeNow() { if (!deleteId) return; await deleteDoc(doc(db,'classes', deleteId)); setDeleteId(undefined); toast({ title:'Aula excluída', status:'info' }); }

  return (
    <VStack align="stretch" spacing={6}>
      <PageCard>
        <Text fontSize="lg" fontWeight={600} mb={3}>Aulas</Text>
        <HStack justify="space-between" mb={2}><Text fontWeight={600}>Filtros</Text></HStack>
        <HStack spacing={3} wrap="wrap">
          <Input placeholder="Modalidade" value={filterMod} onChange={(e)=>setFilterMod(e.target.value)} maxW="240px" />
          <Input type="date" value={filterDate} onChange={(e)=>setFilterDate(e.target.value)} maxW="200px" />
          <Button borderRadius="md" onClick={()=>{}}>Buscar</Button>
          <Button variant="outline" borderRadius="md" onClick={()=>{ setFilterMod(''); setFilterDate(''); }}>Limpar</Button>
        </HStack>

        <HStack mt={4} spacing={3} wrap="wrap">
          <Controller name="modality" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.modality} isRequired>
              <Input placeholder="Modalidade" {...field} />
              <FormErrorMessage>{errors.modality?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="date" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.date} isRequired>
              <Input type="date" placeholder="Data" {...field} />
              <FormErrorMessage>{errors.date?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Button borderRadius="md" colorScheme="blue" onClick={add} isDisabled={!isValid || isSubmitting} isLoading={isSubmitting}>Salvar</Button>
        </HStack>

        {loading ? <Center py={10}><Spinner /></Center> : (
          <Table size="sm" mt={4}>
            <Thead><Tr><Th>Modalidade</Th><Th>Data</Th><Th></Th></Tr></Thead>
            <Tbody>
              {filtered.map(c => (
                <Tr key={c.id}>
                  <Td>{c.modality}</Td>
                  <Td>{(c.startsAt as any).toDate().toISOString().slice(0,10)}</Td>
                  <Td><Button size="xs" variant="outline" colorScheme='red' onClick={()=>setDeleteId(c.id)}>Excluir</Button></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <AlertDialog isOpen={!!deleteId} leastDestructiveRef={cancelRef} onClose={()=>setDeleteId(undefined)}>
          <AlertDialogOverlay />
          <AlertDialogContent>
            <AlertDialogHeader>Confirmar exclusão</AlertDialogHeader>
            <AlertDialogBody>Tem certeza que deseja excluir esta aula?</AlertDialogBody>
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
