"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { db, storage } from '@/lib/firebase';
import { Button, Checkbox, FormControl, FormErrorMessage, FormLabel, HStack, Input, Select, Text, VStack, useToast, Badge, Image, SimpleGrid, Tabs, TabList, TabPanels, Tab, TabPanel, Textarea, Box, Spinner, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, Flex } from '@chakra-ui/react';
import { collection, deleteField, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import VideoCanvas from '@/components/VideoCanvas';
import { useFaceModels } from '@/lib/face/useFaceModels';
import { getEmbeddingFor, centroid } from '@/lib/face/match1vN';
import LivenessHint from '@/components/LivenessHint';
function onlyDigits(v: string) { return String(v||'').replace(/\D/g,''); }
function isMinor(iso?: string) {
  const [y,m,d] = String(iso||'').split('-').map(Number);
  const b = new Date(y||0, (m||1)-1, d||1);
  const n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  const md = n.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && n.getDate() < b.getDate())) age--;
  return age < 18;
}

const schema = yup.object({
  name: yup.string().trim().min(2,'Nome muito curto').required('Nome obrigatório'),
  birthDate: yup.string().required('Data de nascimento obrigatória'),
  whatsapp: yup.string().optional().test('wpp','WhatsApp inválido', function(v){
    const bd=(this.parent as any).birthDate; const d=onlyDigits(String(v||'')); const ok=(d.length===10||d.length===11);
    if (isMinor(bd)) { return !v || ok; } return !!v && ok;
  }),
  email: yup.string()
    .transform(v=>{ const s=String(v||'').trim().toLowerCase(); return s===''? undefined as any : s; })
    .email('E-mail inválido')
    .test('email-req','E-mail obrigatório', function(v){ const bd=(this.parent as any).birthDate; return isMinor(bd) ? true : !!v; }),
  guardianName: yup.string().test('gname-req','Nome do responsável obrigatório', function(v){ const bd=(this.parent as any).birthDate; return isMinor(bd) ? !!String(v||'').trim() : true; }),
  guardianPhone: yup.string().test('gphone','WhatsApp do responsável inválido/obrigatório', function(v){ const bd=(this.parent as any).birthDate; const d=onlyDigits(String(v||'')); const ok=(d.length===10||d.length===11); return isMinor(bd) ? (!!v && ok) : (!v || ok); }),
  guardianEmail: yup.string().transform(v=>{ const s=String(v||'').trim().toLowerCase(); return s===''? undefined as any : s; }).email('E-mail do responsável inválido'),
  active: yup.boolean().default(true),
  activePlanId: yup.string().required('Plano obrigatório'),
  weightKg: yup.string().optional(),
  heightCm: yup.string().optional(),
  techNotes: yup.string().optional(),
});

type FormData = yup.InferType<typeof schema>;

import { simpleLiveness } from '@/lib/face/liveness';

type Plan = { id: string; name: string };

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { ready: faceReady, error: faceErr } = useFaceModels();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const { control, handleSubmit, formState: { isValid, isSubmitting }, reset, watch, trigger } = useForm<any>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: { name:'', birthDate:'', whatsapp:'', email:'', guardianName:'', guardianPhone:'', guardianEmail:'', active:true, activePlanId:'', weightKg:'', heightCm:'', techNotes:'' }
  });

  // Face enrollment state
  const [video, setVideo] = useState<HTMLVideoElement|null>(null);
  const videoRef = useRef<HTMLVideoElement|null>(null);
  useEffect(()=>{ videoRef.current = video; }, [video]);
  useEffect(()=>{ return ()=>{ try { const v = videoRef.current; if (v?.srcObject) (v.srcObject as MediaStream).getTracks().forEach(t=>t.stop()); } catch {} }; }, []);

  const [livenessOk, setLivenessOk] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [savingFace, setSavingFace] = useState(false);
  const [photoBlobs, setPhotoBlobs] = useState<Blob[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const isMinorNow = isMinor(watch('birthDate'));

  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);


  const [tabIndex, setTabIndex] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIdx, setConfirmIdx] = useState<number|null>(null);
  const [confirmKind, setConfirmKind] = useState<'new'|'existing'|null>(null);

  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const openConfirm = (i: number, kind: 'new'|'existing') => { setConfirmIdx(i); setConfirmKind(kind); setConfirmOpen(true); };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmIdx(null); };
  const confirmDelete = async () => {
    if (confirmIdx == null) return;
    setDeletingPhoto(true);
    try {
      if (confirmKind === 'new') {
        removePreviewAt(confirmIdx);
      } else {
        await removeExistingAt(confirmIdx);
      }
    } finally { setDeletingPhoto(false); setConfirmKind(null); closeConfirm(); }
  };

  const removePreviewAt = (idx: number) => {
    setPhotoBlobs(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
    setSamples(prev => prev.filter((_, i) => i !== idx));
  };

  const removeExistingAt = async (idx: number) => {
    const nextPhotos = existingPhotos.filter((_, i) => i !== idx);
    try {
      const url = existingPhotos[idx];
      try { await deleteObject(ref(storage, url)); } catch {}

      const snap = await getDoc(doc(db,'students', id));
      const data = (snap.exists() ? snap.data() : {}) as any;
      let nextDescriptors: any[] = Array.isArray(data?.descriptors) ? [...data.descriptors] : [];
      if (nextDescriptors.length > idx) nextDescriptors.splice(idx, 1);


      const update: any = { photos: nextPhotos };
      if (nextDescriptors.length > 0) {
        update.descriptors = nextDescriptors;
        const vecs: number[][] = nextDescriptors.map((d:any)=> Array.isArray(d?.v) ? d.v : d);
        update.centroid = centroid(vecs);
      } else {
        update.descriptors = deleteField();
        update.centroid = deleteField();
      }

      await updateDoc(doc(db,'students', id), update);
      setExistingPhotos(nextPhotos);
      setExistingSamples(nextDescriptors.length);
      toast({ title: 'Foto removida', status: 'success' });
    } catch (e: any) {
      toast({ title: 'Erro ao remover foto', description: String(e?.message || e), status: 'error' });
    }
  };

  const [existingSamples, setExistingSamples] = useState<number>(0);

  useEffect(()=>{
    getDocs(collection(db,'plans')).then(s => setPlans(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
  }, []);

  useEffect(()=>{
    (async()=>{
      try {
        setLoadingPage(true);
        const snap = await getDoc(doc(db,'students', id));
        const data = snap.data() as any;
        const defaults = {
          name: data?.name||'',
          birthDate: data?.birthDate||'',
          email: data?.email||'',
          whatsapp: data?.whatsapp || data?.phone || '',
          guardianName: data?.guardianName||'',
          guardianPhone: data?.guardianPhone||'',
          guardianEmail: data?.guardianEmail||'',
          active: !!data?.active,
          activePlanId: data?.activePlanId||'',
          weightKg: data?.weightKg ? String(data.weightKg) : '',
          heightCm: data?.heightCm ? String(data.heightCm) : '',
          techNotes: data?.techNotes||'',
        };
        reset(defaults);
        await trigger();
        const dcount = Array.isArray(data?.descriptors) ? data.descriptors.length : 0;
        setExistingSamples(dcount);
        setExistingPhotos(Array.isArray(data?.photos) ? data.photos : []);
      } finally {
        setLoadingPage(false);
      }
    })();
  }, [id, reset, trigger]);


  // liveness loop with throttling
  useEffect(()=>{
    if (!video || !faceReady) return;
    let active = true;
    let running = false;
    const id = window.setInterval(async ()=>{
      if (!active || running) return;
      running = true;
      try { const lv = await simpleLiveness(video); if (active) setLivenessOk(!!(lv.blinked && lv.turned)); } catch {}
      finally { running = false; }
    }, 250);
    return ()=>{ active = false; window.clearInterval(id); };
  }, [video, faceReady]);

  const save = handleSubmit(async (data) => {
    const opt = (v: any) => (v && String(v).trim() !== '' ? v : deleteField());
    const toNum = (s:any) => { const x = String(s||'').replace(/\./g,'').replace(',','.'); const n = Number(x); return Number.isFinite(n) ? n : ''; };

    const update: any = {
      name: data.name,
      phone: data.whatsapp,
      whatsapp: data.whatsapp,
      active: !!data.active,
      activePlanId: opt(data.activePlanId),
      email: opt(data.email),
      birthDate: opt(data.birthDate),
      guardianName: opt(data.guardianName),
      guardianPhone: opt(data.guardianPhone),
      weightKg: opt(toNum(data.weightKg)),
      heightCm: opt(toNum(data.heightCm)),
      techNotes: opt(data.techNotes),
      guardianEmail: opt(data.guardianEmail),
    };
    if (samples.length >= 3) {
      update.descriptors = samples.map(v=>({ v }));
      update.centroid = centroid(samples);
    }
    if (photoBlobs.length) {
      const newUrls: string[] = [];
      for (let i=0;i<photoBlobs.length;i++) {
        const b = photoBlobs[i];
        const path = `students/${id}/${Date.now()}-${i}.jpg`;
        const r = ref(storage, path);
        await uploadBytes(r, b, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(r);
        newUrls.push(url);
      }
      update.photos = [...existingPhotos, ...newUrls];
    }
    await updateDoc(doc(db,'students', id), update);
    if (photoBlobs.length) { setExistingPhotos(update.photos); setPhotoBlobs([]); setPhotoPreviews([]); }
    if (samples.length >= 3) { setExistingSamples(samples.length); setSamples([]); }
    toast({ title:'Aluno atualizado', status:'success' });
    try { if (video?.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t=>t.stop()); } catch {}
    setVideo(null);
    router.push('/admin/students');
  }, () => { toast({ title:'Formulário inválido', status:'error' }); });

  async function captureCurrentFrameBlob(v: HTMLVideoElement): Promise<{ blob: Blob; dataUrl: string }> {
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 640; canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(v,0,0,canvas.width,canvas.height);
    const blob: Blob = await new Promise((res)=> canvas.toBlob((b)=>res(b as Blob), 'image/jpeg', 0.9));
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { blob, dataUrl };
  }

  async function captureSample() {
    if (!video || !faceReady) return;
    if (samples.length >= 5) { toast({ title:'Limite atingido', description:'Você pode coletar no máximo 5 amostras', status:'info' }); return; }
    setCapturing(true);
    toast({ title:'Captura iniciada', status:'info', duration: 1200 });
    try {
      const emb = await getEmbeddingFor(video);
      if (!emb) { toast({ title:'Rosto não detectado', status:'warning' }); return; }
      const { blob, dataUrl } = await captureCurrentFrameBlob(video);
      setPhotoBlobs(prev => [...prev, blob]);
      setPhotoPreviews(prev => [...prev, dataUrl]);
      setSamples(prev => [...prev, Array.from(emb) as number[]]);
    } finally {
      setCapturing(false);
    }
  }

  async function saveBiometrics() {
    if (!samples.length && !photoBlobs.length) return;
    setSavingFace(true);
    try {
      const newUrls: string[] = [];
      for (let i=0;i<photoBlobs.length;i++) {
        const b = photoBlobs[i];
        const path = `students/${id}/${Date.now()}-${i}.jpg`;
        const r = ref(storage, path);
        await uploadBytes(r, b, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(r);
        newUrls.push(url);
      }
      const update: any = {};
      if (samples.length) { update.descriptors = samples.map(v=>({ v })); update.centroid = centroid(samples); }
      if (newUrls.length) { update.photos = [...existingPhotos, ...newUrls]; }
      if (Object.keys(update).length) {
        await updateDoc(doc(db,'students', id), update);
      }
      if (newUrls.length) setExistingPhotos(prev => [...prev, ...newUrls]);
      if (samples.length) { setExistingSamples(samples.length); setSamples([]); }
      setPhotoBlobs([]); setPhotoPreviews([]);
      toast({ title:'Dados biométricos atualizados', status:'success' });
    } catch (e:any) {
      toast({ title:'Erro ao salvar biometria', description: String(e?.message||e), status:'error' });
    } finally {
      setSavingFace(false);
    }
  }

  async function clearBiometrics() {
    setSavingFace(true);
    try {
      await updateDoc(doc(db,'students', id), { descriptors: deleteField(), centroid: deleteField() });
      setExistingSamples(0);
      setSamples([]);
      toast({ title:'Biometria removida', status:'info' });
    } catch (e:any) {
      toast({ title:'Erro ao remover biometria', description: String(e?.message||e), status:'error' });
    } finally {
      setSavingFace(false);
    }
  }

  return (
    <>
      {loadingPage && (
        <Flex position="fixed" inset={0} zIndex={1000} align="center" justify="center" bg="rgba(0,0,0,0.28)">
          <Box bg="white" px={4} py={2} borderRadius="md" boxShadow="lg">
            <HStack spacing={3}><Spinner size="sm" /><Text fontWeight={600}>Carregando...</Text></HStack>
          </Box>
        </Flex>
      )}
      <VStack align="stretch" spacing={6}>
        <Tabs variant="enclosed" isLazy lazyBehavior="unmount" index={tabIndex} onChange={(i)=>{ if (tabIndex===2 && i!==2) { try { if (video?.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t=>t.stop()); } catch {} setVideo(null); setCapturing(false); } setTabIndex(i); }}>
        <TabList>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Dados gerais</Tab>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Ficha técnica</Tab>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Biometria facial</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={6}>
                <HStack>
                  <Icon name='users' />
                  <Text fontSize="xl" fontWeight={700}>Edição de aluno</Text>
                </HStack>
                <VStack align="stretch" spacing={4}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} alignItems="start">
                    {/* Coluna 1: dados principais */}
                    <VStack align="stretch" spacing={4}>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="name" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired>
                            <FormLabel>Nome</FormLabel>
                            <Input placeholder="Nome" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="birthDate" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired>
                            <FormLabel>Data de nascimento</FormLabel>
                            <Input type="date" placeholder="Data de nascimento" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="email" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired={!isMinorNow}>
                            <FormLabel>E-mail</FormLabel>
                            <Input type="email" placeholder="E-mail" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="whatsapp" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired={!isMinorNow}>
                            <FormLabel>WhatsApp</FormLabel>
                            <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="WhatsApp" value={field.value as any} onAccept={(val:any)=>field.onChange(val)} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="activePlanId" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState?.error} isRequired>
                            <FormLabel>Plano</FormLabel>
                            <Select placeholder="Selecione um plano" maxW="240px" {...field}>
                              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                            <FormErrorMessage>{fieldState?.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="active" control={control} render={({ field }) => (
                          <Checkbox isChecked={!!field.value} onChange={(e)=>field.onChange(e.target.checked)}>Ativo</Checkbox>
                        )}/>
                      </HStack>
                    </VStack>

                    {/* Coluna 2: respons e1vel */}
                    <VStack align="stretch" spacing={2}>
                      <Text fontWeight={600} marginTop={5}>Dados do responsável</Text>
                      <Text color="gray.600" fontSize="sm" marginBottom={1} >Obrigatório telefone e e-mail do responsável para menor de idade</Text>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="guardianName" control={control} render={({ field, fieldState }) => (
                          <FormControl  isInvalid={!!fieldState.error} isRequired={isMinorNow} isDisabled={!isMinorNow}>
                            <FormLabel>Nome do responsável</FormLabel>
                            <Input placeholder="Nome do responsável" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="guardianEmail" control={control} render={({ field, fieldState }) => (
                          <FormControl marginTop={0.5} isInvalid={!!fieldState.error} isDisabled={!isMinorNow}>
                            <FormLabel>E-mail do responsável</FormLabel>
                            <Input type="email" placeholder="E-mail do responsável" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="guardianPhone" control={control} render={({ field, fieldState }) => (
                          <FormControl marginTop={0.5} isInvalid={!!fieldState.error} isRequired={isMinorNow} isDisabled={!isMinorNow}>
                            <FormLabel>WhatsApp do responsável</FormLabel>
                            <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="WhatsApp do responsável" value={field.value as any} onAccept={(val:any)=>field.onChange(val)} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>
                    </VStack>
                  </SimpleGrid>
                </VStack>
              </VStack>
            </PageCard>
          </TabPanel>

          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={6}>
                <Text fontSize="xl" fontWeight={700}>Ficha técnica</Text>
                <HStack spacing={3} wrap="wrap">
                  <Controller name="weightKg" control={control} render={({ field }) => (
                    <FormControl>
                      <FormLabel>Peso (kg)</FormLabel>
                      <Input as={IMaskInput as any}
                             mask={Number}
                             radix=","
                             mapToRadix={["."]}
                             thousandsSeparator="."
                             scale={2}
                             normalizeZeros
                             padFractionalZeros={true}
                             placeholder="Peso (kg)" maxW="200px"
                             value={field.value as any}
                             onAccept={(val:any)=>field.onChange(val)} />
                    </FormControl>
                  )}/>
                  <Controller name="heightCm" control={control} render={({ field }) => (
                    <FormControl>
                      <FormLabel>Altura (cm)</FormLabel>
                      <Input as={IMaskInput as any}
                             mask={Number}
                             radix=","
                             mapToRadix={["."]}
                             thousandsSeparator="."
                             scale={2}
                             normalizeZeros
                             padFractionalZeros={true}
                             placeholder="Altura (cm)" maxW="200px"
                             value={field.value as any}
                             onAccept={(val:any)=>field.onChange(val)} />
                    </FormControl>
                  )}/>
                </HStack>
                <Controller name="techNotes" control={control} render={({ field }) => (
                  <FormControl>
                    <FormLabel>Histórico/observações</FormLabel>
                    <Textarea placeholder="Histórico/observações" {...field} />
                  </FormControl>
                )}/>
              </VStack>
            </PageCard>
          </TabPanel>

          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" align="center">
                  <HStack>
                    <Icon name='camera' />
                    <Text fontSize="lg" fontWeight={700}>Biometria facial</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <Badge colorScheme={faceReady ? 'green' : faceErr ? 'red' : 'gray'}>
                      Modelos {faceReady ? 'OK' : faceErr ? 'Erro' : 'Carregando'}
                    </Badge>
                    <Badge colorScheme={video ? 'green' : 'gray'}>Câmera {video ? 'OK' : 'Off'}</Badge>
                    <Badge colorScheme={existingSamples>0?'green':'red'}>{existingSamples>0 ? `${existingSamples} amostras` : 'Sem amostras'}</Badge>
                    <Badge colorScheme={existingPhotos.length>0?'green':'gray'}>{existingPhotos.length>0 ? `${existingPhotos.length} fotos` : 'Sem fotos'}</Badge>
                  </HStack>
                </HStack>
                <Text color="gray.600">Colete ao menos 3 amostras com boa iluminação, centralizando o rosto.</Text>
                {!!faceErr && <Text color='red.500' fontSize='sm'>{faceErr}</Text>}
                <Box position="relative" width="400px" height="400px" display="inline-block">
                  <VideoCanvas size={400} onReady={(v)=>setVideo(v)} />
                  {capturing && (
                    <Box position="absolute" inset={0} display="flex" alignItems="center" justifyContent="center" bg="rgba(0,0,0,0.35)" zIndex={1}>
                      <HStack spacing={3} bg="rgba(255,255,255,0.9)" px={4} py={2} borderRadius="md" boxShadow="md">
                        <Spinner size="sm" />
                        <Text color="gray.800" fontWeight={600}>Capturando...</Text>
                      </HStack>
                    </Box>
                  )}
                </Box>
                <LivenessHint ok={livenessOk} />
                <HStack>
                  <Button variant='secondary' onClick={captureSample} isDisabled={!video || !faceReady || capturing || samples.length>=5} isLoading={capturing} loadingText="Capturando...">Capturar amostra</Button>
                  <Text color="gray.700">Amostras coletadas: {samples.length}/5</Text>
                </HStack>
                {photoPreviews.length>0 && (
                  <VStack align="stretch" spacing={2}>
                    <Text color="gray.700" fontSize="sm">Novas fotos (não salvas ainda)</Text>
                    <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
                      {photoPreviews.map((src, i)=> (
                        <Box key={`new-${i}`} position="relative" boxSize="96px">
                          <Image src={src} alt={`nova ${i+1}`} borderRadius="md" boxSize="96px" objectFit="cover" />
                          <Button size="xs" onClick={()=>openConfirm(i,'new')} position="absolute" top={1} right={1} borderRadius="full" bg="white" _hover={{ bg:'red.500', color:'white' }}>x</Button>
                        </Box>
                      ))}
                    </SimpleGrid>
                  </VStack>
                )}
                {existingPhotos.length>0 && (
                  <VStack align="stretch" spacing={2}>
                    <Text color="gray.700" fontSize="sm">Fotos salvas</Text>
                    <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
                      {existingPhotos.map((src, i)=> (
                        <Box key={`old-${i}`} position="relative" boxSize="96px">
                          <Image src={src} alt={`salva ${i+1}`} borderRadius="md" boxSize="96px" objectFit="cover" />
                          <Button size="xs" onClick={()=>openConfirm(i,'existing')} position="absolute" top={1} right={1} borderRadius="full" bg="white" _hover={{ bg:'red.500', color:'white' }}>x</Button>
                        </Box>
                      ))}
                    </SimpleGrid>
                  </VStack>
                )}
              </VStack>
            </PageCard>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <HStack justify="flex-end">
        <Button variant="ghost" onClick={()=>{ try { if (video?.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t=>t.stop()); } catch {}; setVideo(null); router.push('/admin/students'); }}>Cancelar</Button>
        <Button variant="secondary" onClick={save} isLoading={isSubmitting} loadingText="Salvando..." isDisabled={!isValid || isSubmitting}>Salvar</Button>
      </HStack>
      {!isSubmitting && !isValid && (
        <Text color="gray.600" fontSize="sm" textAlign="right">
          Preencha os campos obrigatórios
        </Text>
      )}

      <AlertDialog isOpen={confirmOpen} leastDestructiveRef={cancelRef} onClose={closeConfirm}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Remover foto</AlertDialogHeader>
            <AlertDialogBody>Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef as any} onClick={closeConfirm}>Cancelar</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3} isLoading={deletingPhoto}>Excluir</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

    </VStack>
    </>
  );
}
