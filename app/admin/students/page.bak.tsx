"use client";
import { db, storage } from '@/lib/firebase';
import { Student } from '@/lib/firestore';
import { loadFaceModels } from '@/lib/face/loadModels';
import { centroid, getEmbeddingFor } from '@/lib/face/match1vN';
import { Avatar, Badge, Box, Button, Checkbox, Flex, FormControl, FormLabel, HStack, Input, Select, SimpleGrid, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react';
import { IMaskInput } from 'react-imask';
import { Timestamp, addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useRef, useState } from 'react';

type Plan = { id: string; name: string };

export default function StudentsPage() {
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [active, setActive] = useState(true);
  const [activePlanId, setActivePlanId] = useState<string|undefined>();
  const [files, setFiles] = useState<FileList|null>(null);
  const [toDelete, setToDelete] = useState<string|undefined>();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db,'students'), orderBy('name')), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      setLoading(false);
    });
    getDocs(collection(db,'plans')).then(s => setPlans(s.docs.map(d => ({ id:d.id, ...(d.data() as any)}))));

    return () => unsub();
  }, []);

  async function uploadPhotosAndDescriptors(studentId: string) {
    if (!files || files.length === 0) return { photos: [], descriptors: [], centroid: undefined as number[]|undefined };
    const photos: string[] = [];
    const descriptors: number[][] = [];
    const img = document.createElement('img');
    for (const f of Array.from(files)) {
      const path = `students/${studentId}/${Date.now()}-${f.name}`;
      const r = ref(storage, path);
      await uploadBytes(r, f);
      const url = await getDownloadURL(r);
      photos.push(url);
      // compute descriptor from uploaded local blob (fallback: from file reader)
      const fr = new FileReader();
      const dataUrl: string = await new Promise((res,rej)=>{ fr.onload=()=>res(fr.result as string); fr.onerror=rej; fr.readAsDataURL(f); });
      img.src = dataUrl; await img.decode();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!; canvas.width=img.width; canvas.height=img.height; ctx.drawImage(img,0,0);
      // @ts-ignore
      const faceapi = await import('face-api.js');
      const det = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 256 })).withFaceLandmarks().withFaceDescriptor();
      if (det?.descriptor) descriptors.push(Array.from(det.descriptor));
    }
    const cent = descriptors.length ? centroid(descriptors) : undefined;
    return { photos, descriptors, centroid: cent };
  }

  function maskPhone(v: string) {
    const d = v.replace(/\D/g,'').slice(0,11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
  }

  async function addStudent() {
    const created = await addDoc(collection(db,'students'), { name, phone, active, activePlanId });
    const { photos, descriptors, centroid } = await uploadPhotosAndDescriptors(created.id);
    await updateDoc(doc(db,'students', created.id), { photos, descriptors, centroid });
    setName(''); setPhone(''); setFiles(null);
    toast({ title: 'Aluno salvo', status: 'success' });
  }

  async function remove(id: string) { setToDelete(id); }
  async function confirmRemove() {
    if (!toDelete) return;
    await deleteDoc(doc(db,'students', toDelete));
    setToDelete(undefined);
    toast({ title: 'Aluno excluÃ­do', status: 'info' });
  }

  function addMonths(d: Date, months: number): Date {
    const nd = new Date(d);
    const targetMonth = nd.getMonth() + months;
    nd.setMonth(targetMonth);
    return nd;
  }

  async function markPaidToday(studentId: string) {
    await updateDoc(doc(db,'students', studentId), { lastPaidAt: Timestamp.fromDate(new Date()) });
  }

  return (
    <VStack align="stretch" spacing={8}>
      <Box>
        <HStack justify="space-between" mb={4}><Text fontSize="lg">Cadastrar aluno</Text></HStack>
        <SimpleGrid columns={[1,2,3,4]} gap={4}>
          <Input placeholder="Nome" value={name} onChange={(e)=>setName(e.target.value)} />
          <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="Telefone" value={phone as any} onAccept={(val: any)=>setPhone(val)} />
          <Select placeholder="Plano" value={activePlanId||''} onChange={(e)=>setActivePlanId(e.target.value||undefined)}>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Checkbox isChecked={!!active} onChange={(e)=>setActive(e.target.checked)}>Ativo</Checkbox>
          <Input type="file" accept="image/*" multiple onChange={(e)=>setFiles(e.target.files)} />
        </SimpleGrid>
        <Button mt={3} onClick={addStudent}>Salvar</Button>
      </Box>

      <Box>
        <HStack justify="space-between" mb={3}><Text fontSize="lg">Alunos</Text></HStack>
        {loading ? <Spinner /> : (
          <Table size="sm" variant="simple">
            <Thead><Tr><Th>Nome</Th><Th>Plano</Th><Th>Status</Th><Th>Pagamento</Th><Th>AÃ§Ãµes</Th></Tr></Thead>
            <Tbody>
              {students.map(s => (
                <Tr key={s.id}>
                  <Td>{s.name}</Td>
                  <Td>{plans.find(p=>p.id===s.activePlanId)?.name||'-'}</Td>
                  <Td>{s.active ? <Badge>Ativo</Badge> : <Badge colorScheme='red'>Inativo</Badge>}</Td>
                  <Td>
                    {(() => {
                      const now = new Date();
                      const lastPaid = s.lastPaidAt ? (s.lastPaidAt as any as Timestamp).toDate() : undefined;
                      const due = lastPaid ? addMonths(lastPaid, 1) : new Date(0);
                      if (!lastPaid) return <Badge colorScheme='red'>Sem pagamento</Badge>;
                      if (now <= due) return <Badge colorScheme='green'>OK</Badge>;
                      return <Badge colorScheme='red'>Atrasado</Badge>;
                    })()}
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <Button size="xs" onClick={()=>markPaidToday(s.id)}>Pago hoje</Button>
                      <Button size="xs" variant="outline" colorScheme='red' onClick={()=>remove(s.id)}>Excluir</Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>
    </VStack>
  );
}

