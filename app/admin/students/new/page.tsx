"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { db, storage } from '@/lib/firebase';
import { Button, Checkbox, FormControl, FormErrorMessage, FormLabel, HStack, Input, Select, Text, VStack, useToast, Badge, Image, SimpleGrid, Tabs, TabList, TabPanels, Tab, TabPanel, Textarea, Box, Spinner, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, useBreakpointValue } from '@chakra-ui/react';
import { addDoc, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IMaskInput } from 'react-imask';
import VideoCanvas from '@/components/VideoCanvas';
import LivenessHint from '@/components/LivenessHint';
import { useFaceModels } from '@/lib/face/useFaceModels';
import { centroid, getEmbeddingFor } from '@/lib/face/match1vN';
import { simpleLiveness } from '@/lib/face/liveness';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';


type Plan = { id: string; name: string };

export default function NewStudentPage() {
  const router = useRouter();
  const toast = useToast();
  const { ready: faceReady, error: faceErr } = useFaceModels();
  const [plans, setPlans] = useState<Plan[]>([]);

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

  const { control, handleSubmit, formState: { isValid, isSubmitting }, watch } = useForm<any>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: { name:'', birthDate:'', whatsapp:'', email:'', guardianName:'', guardianPhone:'', guardianEmail:'', active:true, activePlanId:'', weightKg:'', heightCm:'', techNotes:'' }
  });

  const [video, setVideo] = useState<HTMLVideoElement|null>(null);
  const isMinorNow = isMinor(watch('birthDate'));
  const videoRef = useRef<HTMLVideoElement|null>(null);
  useEffect(()=>{ videoRef.current = video; }, [video]);
  useEffect(()=>{ return ()=>{ try { const v = videoRef.current; if (v?.srcObject) (v.srcObject as MediaStream).getTracks().forEach(t=>t.stop()); } catch {} }; }, []);


  const [livenessOk, setLivenessOk] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [photoBlobs, setPhotoBlobs] = useState<Blob[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);


  const removePreviewAt = (idx: number) => {
    setPhotoBlobs(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
    setSamples(prev => prev.filter((_, i) => i !== idx));
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIdx, setConfirmIdx] = useState<number|null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const openConfirm = (i: number) => { setConfirmIdx(i); setConfirmOpen(true); };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmIdx(null); };
  const confirmDelete = async () => {
    if (confirmIdx == null) return;
    setDeletingPhoto(true);
    try { removePreviewAt(confirmIdx); } finally { setDeletingPhoto(false); closeConfirm(); }
  };



  useEffect(()=>{
    getDocs(collection(db,'plans')).then(s => setPlans(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
  }, []);
  useEffect(()=>{
    if (!video || !faceReady) return;
    let active = true;
    let running = false;
    const id = window.setInterval(async () => {
      if (!active || running) return;
      running = true;
      try { const lv = await simpleLiveness(video); if (active) setLivenessOk(!!(lv.blinked && lv.turned)); } catch {}
      finally { running = false; }
    }, 250);
    return () => { active = false; window.clearInterval(id); };
  }, [video, faceReady]);

  const save = handleSubmit(async (data) => {
    if (!data.activePlanId) { toast({ title:'Selecione um plano válido', status:'warning' }); return; }
    const payload: any = {
      name: data.name,
      phone: data.whatsapp,
      whatsapp: data.whatsapp,
      active: !!data.active,
    };
    if (data.email) payload.email = data.email;
    if (data.birthDate) payload.birthDate = data.birthDate;
    if (data.guardianName) payload.guardianName = data.guardianName;
    if (data.guardianPhone) payload.guardianPhone = data.guardianPhone;
    if (data.guardianEmail) payload.guardianEmail = data.guardianEmail;
    if (data.activePlanId) payload.activePlanId = data.activePlanId;
    const toNum = (s:any) => { const x = String(s||'').replace(/\./g,'').replace(',','.'); const n = Number(x); return Number.isFinite(n) ? n : undefined; };
    if (data.weightKg) payload.weightKg = toNum(data.weightKg);
    if (data.heightCm) payload.heightCm = toNum(data.heightCm);
    if (data.techNotes) payload.techNotes = data.techNotes;

    const created = await addDoc(collection(db,'students'), payload);
    // Upload de fotos (se houver)
    let photos: string[] = [];
    if (photoBlobs.length) {
      for (let i=0;i<photoBlobs.length;i++) {
        const b = photoBlobs[i];
        const path = `students/${created.id}/${Date.now()}-${i}.jpg`;
        const r = ref(storage, path);
        await uploadBytes(r, b, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(r); photos.push(url);
      }
    }
    // Atualiza campos opcionais (fotos, descritores) somente se fornecidos
    const upd: any = {};
    if (photos.length) upd.photos = photos;
    if (samples.length) { upd.descriptors = samples.map(v=>({ v })); upd.centroid = centroid(samples); }
    if (Object.keys(upd).length) { await updateDoc(doc(db,'students', created.id), upd); }

    toast({ title:'Aluno criado', status:'success' });
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

  const videoSize = useBreakpointValue({ base: 300, md: 500 });

  return (
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
                  <Text fontSize="xl" fontWeight={700}>Dados gerais</Text>
                </HStack>
                <VStack as="form" onSubmit={(e)=>{ e.preventDefault(); }} align="stretch" spacing={4}>
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

                    {/* Coluna 2: responsável */}
                    <VStack align="stretch" spacing={2}>
                      <Text fontWeight={600} marginTop={5}>Dados do responsável</Text>
                      <Text color="gray.600" fontSize="sm" marginBottom={1}>Obrigatório Whatsapp do responsável para menor de idade</Text>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="guardianName" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired={isMinorNow} isDisabled={!isMinorNow}>
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
                <VStack align="stretch" spacing={3}>
                  <HStack>
                    <Icon name='camera' />
                    <Text fontSize="lg" fontWeight={700}>Biometria facial</Text>
                  </HStack>
                  <VStack align="stretch" spacing={2}>
                    <Badge colorScheme={faceReady ? 'green' : faceErr ? 'red' : 'gray'} alignSelf="flex-start">
                      Modelos {faceReady ? 'OK' : faceErr ? 'Erro' : 'Carregando'}
                    </Badge>
                    <Badge colorScheme={samples.length>=3?'green':'red'} alignSelf="flex-start">{samples.length>=3 ? `${samples.length} amostras` : 'mín. 3 amostras'}</Badge>
                  </VStack>
                </VStack>
                <Text color="gray.600">Colete ao menos 3 amostras com boa iluminação, centralizando o rosto.</Text>
                {!!faceErr && <Text color='red.500' fontSize='sm'>{faceErr}</Text>}
                <Box position="relative" width={{ base: "100%", md: "500px" }} height={{ base: "300px", md: "500px" }} display="inline-block" maxW="500px">
                  <VideoCanvas size={videoSize || 300} onReady={setVideo} />
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
                <VStack align="stretch" spacing={2}>
                  <Button variant='secondary' onClick={captureSample} isDisabled={!video || !faceReady || capturing || samples.length>=5} isLoading={capturing} loadingText="Capturando...">Capturar amostra</Button>
                  <Text color="gray.700" textAlign="center">Amostras coletadas: {samples.length}/5</Text>
                </VStack>
                {photoPreviews.length>0 && (
                  <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
                    {photoPreviews.map((src, i)=> (
                      <Box key={i} position="relative" boxSize="96px">
                        <Image src={src} alt={`amostra ${i+1}`} borderRadius="md" boxSize="96px" objectFit="cover" />
                        <Button size="xs" onClick={()=>openConfirm(i)} position="absolute" top={1} right={1} borderRadius="full" bg="white" _hover={{ bg:'red.500', color:'white' }}>x</Button>
                      </Box>
                    ))}
                  </SimpleGrid>
                )}
              </VStack>
            </PageCard>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <HStack justify="flex-end">
        <Button variant="ghost" onClick={()=>{ try { if (video?.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t=>t.stop()); } catch {} setVideo(null); router.push('/admin/students'); }}>Cancelar</Button>
        <Button variant="secondary" onClick={save} isLoading={isSubmitting} loadingText="Salvando..." isDisabled={!isValid || isSubmitting || !watch('activePlanId')}>Salvar</Button>
      </HStack>
      {!isSubmitting && (!isValid || !watch('activePlanId')) && (
        <Text color="gray.600" fontSize="sm" textAlign="right">
          {!isValid ? 'Preencha os campos obrigatórios' : 'Selecione um plano'}
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
  );
}

