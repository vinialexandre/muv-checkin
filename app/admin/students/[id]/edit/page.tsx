"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { db, storage } from '@/lib/firebase';
import { Button, Checkbox, FormControl, FormErrorMessage, HStack, Input, Select, Text, VStack, useToast, Badge, Image, SimpleGrid } from '@chakra-ui/react';
import { collection, deleteField, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IMaskInput } from 'react-imask';
import VideoCanvas from '@/components/VideoCanvas';
import { useFaceModels } from '@/lib/face/useFaceModels';
import { getEmbeddingFor, centroid } from '@/lib/face/match1vN';
import LivenessHint from '@/components/LivenessHint';
import { simpleLiveness } from '@/lib/face/liveness';

type Plan = { id: string; name: string };

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { ready: faceReady, error: faceErr } = useFaceModels();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [active, setActive] = useState(true);
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [nameErr, setNameErr] = useState<string|undefined>();
  const [phoneErr, setPhoneErr] = useState<string|undefined>();
  const [saving, setSaving] = useState(false);

  // Face enrollment state
  const [video, setVideo] = useState<HTMLVideoElement|null>(null);
  const [livenessOk, setLivenessOk] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [savingFace, setSavingFace] = useState(false);
  const [photoBlobs, setPhotoBlobs] = useState<Blob[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);

  const [existingSamples, setExistingSamples] = useState<number>(0);

  useEffect(()=>{
    getDocs(collection(db,'plans')).then(s => setPlans(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
  }, []);

  useEffect(()=>{
    (async()=>{
      const snap = await getDoc(doc(db,'students', id));
      const data = snap.data() as any;
      setName(data?.name||'');
      setPhone(data?.phone||'');
      setActive(!!data?.active);
      setActivePlanId(data?.activePlanId||'');
      const dcount = Array.isArray(data?.descriptors) ? data.descriptors.length : 0;
      setExistingSamples(dcount);
      setExistingPhotos(Array.isArray(data?.photos) ? data.photos : []);
    })();
  }, [id]);


  // liveness loop when video available
  useEffect(()=>{
    let raf: number|undefined;
    const tick = async () => {
      if (video && faceReady) {
        try { const lv = await simpleLiveness(video); setLivenessOk(lv.blinked && lv.turned); } catch {}
      }
      raf = requestAnimationFrame(tick);
    };
    if (video) { raf = requestAnimationFrame(tick); }
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [video, faceReady]);

  function validate(): boolean {
    let ok = true;
    if (!name || name.trim().length < 2) { setNameErr('Nome obrigatório'); ok = false; }
    const digits = (phone||'').replace(/\D/g,'');
    if (digits && !(digits.length===10 || digits.length===11)) { setPhoneErr('Telefone inválido'); ok = false; }
    return ok;
  }

  async function save() {
    if (!validate()) return;
    // Enforce biometrics: must have existing or new samples
    if (existingSamples === 0 && samples.length < 3) {
      toast({ title:'Biometria facial obrigatória', description:'Colete ao menos 3 amostras e salve', status:'warning' });
      return;
    }
    setSaving(true);
    try {
      const update: any = { name, phone, active, activePlanId: activePlanId || undefined };
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
      router.push('/admin/students');
    } finally {
      setSaving(false);
    }
  }

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
    const emb = await getEmbeddingFor(video);
    if (!emb) { toast({ title:'Rosto não detectado', status:'warning' }); return; }
    const { blob, dataUrl } = await captureCurrentFrameBlob(video);
    setPhotoBlobs(prev => [...prev, blob]);
    setPhotoPreviews(prev => [...prev, dataUrl]);
    setSamples(prev => [...prev, Array.from(emb) as number[]]);
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
    <VStack align="stretch" spacing={6}>
      <PageCard>
        <VStack align="stretch" spacing={6}>
          <HStack>
            <Icon name='users' />
            <Text fontSize="xl" fontWeight={700}>Edição de aluno</Text>
          </HStack>
          <HStack spacing={3} wrap="wrap">
            <FormControl isInvalid={!!nameErr} isRequired>
              <Input placeholder="Nome" value={name} onChange={(e)=>{ setName(e.target.value); if (nameErr) setNameErr(undefined); }} onBlur={()=>{ if (!name || name.trim().length<2) setNameErr('Nome obrigatório'); }} />
              <FormErrorMessage>{nameErr}</FormErrorMessage>
            </FormControl>
            <FormControl isInvalid={!!phoneErr}>
              <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="Telefone" value={phone as any} onAccept={(val:any)=>{ setPhone(val); if (phoneErr) setPhoneErr(undefined); }} onBlur={()=>{ const d=(phone||'').replace(/\D/g,''); if (d && !(d.length===10||d.length===11)) setPhoneErr('Telefone inválido'); }} />
              <FormErrorMessage>{phoneErr}</FormErrorMessage>
            </FormControl>
            <Select placeholder="Plano" value={activePlanId} onChange={(e)=>setActivePlanId(e.target.value)} maxW="240px">
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Checkbox isChecked={active} onChange={(e)=>setActive(e.target.checked)}>Ativo</Checkbox>
          </HStack>
        </VStack>
      </PageCard>

      <PageCard>
        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between" align="center">
            <HStack>
              <Icon name='camera' />
              <Text fontSize="lg" fontWeight={700}>Biometria facial (obrigatória)</Text>
            </HStack>
            <HStack spacing={2}>
              <Badge colorScheme={faceReady ? 'green' : faceErr ? 'red' : 'gray'}>
                Modelos {faceReady ? 'OK' : faceErr ? 'Erro' : 'Carregando'}
              </Badge>
              <Badge colorScheme={video ? 'green' : 'gray'}>Câmera {video ? 'OK' : 'Off'}</Badge>
              <Badge colorScheme={existingSamples>0?'green':'gray'}>{existingSamples>0? `${existingSamples} amostras salvas` : 'Sem biometria'}</Badge>
            </HStack>
          </HStack>
          <Text color="gray.600">Colete ao menos 3 amostras com boa iluminação, centralizando o rosto.</Text>
          {!!faceErr && <Text color='red.500' fontSize='sm'>{faceErr}</Text>}
          <VideoCanvas onReady={(v)=>setVideo(v)} />
          <LivenessHint ok={livenessOk} />
          <HStack>
            <Button variant='secondary' onClick={captureSample} isDisabled={!video || !faceReady}>Capturar amostra</Button>
            <Text color="gray.700">Amostras coletadas: {samples.length}/5</Text>
          </HStack>
          {photoPreviews.length>0 && (
            <VStack align="stretch" spacing={2}>
              <Text color="gray.700" fontSize="sm">Novas fotos (não salvas ainda)</Text>
              <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
                {photoPreviews.map((src, i)=> (
                  <Image key={`new-${i}`} src={src} alt={`nova ${i+1}`} borderRadius="md" boxSize="96px" objectFit="cover" />
                ))}
              </SimpleGrid>
            </VStack>
          )}
          {existingPhotos.length>0 && (
            <VStack align="stretch" spacing={2}>
              <Text color="gray.700" fontSize="sm">Fotos salvas</Text>
              <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
                {existingPhotos.map((src, i)=> (
                  <Image key={`old-${i}`} src={src} alt={`salva ${i+1}`} borderRadius="md" boxSize="96px" objectFit="cover" />
                ))}
              </SimpleGrid>
            </VStack>
          )}

        </VStack>
      </PageCard>

      <HStack justify="flex-end">
        <Button variant="ghost" onClick={()=>router.push('/admin/students')}>Cancelar</Button>
        <Button variant="secondary" onClick={save} isLoading={saving} isDisabled={existingSamples===0 && samples.length<3}>Salvar</Button>
      </HStack>
    </VStack>
  );
}
