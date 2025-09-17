"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { db } from '@/lib/firebase';
import { Button, Checkbox, FormControl, FormErrorMessage, HStack, Input, Select, Text, VStack, useToast, Badge } from '@chakra-ui/react';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IMaskInput } from 'react-imask';
import VideoCanvas from '@/components/VideoCanvas';
import LivenessHint from '@/components/LivenessHint';
import { loadFaceModels } from '@/lib/face/loadModels';
import { centroid, getEmbeddingFor } from '@/lib/face/match1vN';
import { simpleLiveness } from '@/lib/face/liveness';

type Plan = { id: string; name: string };

export default function NewStudentPage() {
  const router = useRouter();
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [active, setActive] = useState(true);
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [nameErr, setNameErr] = useState<string|undefined>();
  const [phoneErr, setPhoneErr] = useState<string|undefined>();
  const [saving, setSaving] = useState(false);
  // Face enrollment state (mandatory)
  const [faceReady, setFaceReady] = useState(false);
  const [faceErr, setFaceErr] = useState<string|undefined>();
  const [video, setVideo] = useState<HTMLVideoElement|null>(null);
  const [livenessOk, setLivenessOk] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const rafRef = useRef<number|undefined>(undefined);

  useEffect(()=>{
    getDocs(collection(db,'plans')).then(s => setPlans(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
  }, []);
  useEffect(()=>{ loadFaceModels().then(()=>setFaceReady(true)).catch((e)=>{ setFaceErr('Modelos de face não encontrados. Coloque os arquivos em /public/models ou permita acesso à CDN.'); console.error(e); }); }, []);
  useEffect(()=>{
    const tick = async () => {
      if (video && faceReady) {
        try { const lv = await simpleLiveness(video); setLivenessOk(!!(lv.blinked && lv.turned)); } catch {}
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [video, faceReady]);

  function validate(): boolean {
    let ok = true;
    if (!name || name.trim().length < 2) { setNameErr('Nome obrigatório'); ok = false; }
    const digits = (phone||'').replace(/\D/g,'');
    if (digits && !(digits.length===10 || digits.length===11)) { setPhoneErr('Telefone inválido'); ok = false; }
    if (samples.length < 3) { toast({ title:'Biometria facial obrigatória', description:'Colete ao menos 3 amostras', status:'warning' }); ok = false; }
    return ok;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const cent = centroid(samples);
      await addDoc(collection(db,'students'), { name, phone, active, activePlanId: activePlanId || undefined, descriptors: samples.map(v=>({ v })), centroid: cent });
      toast({ title:'Aluno criado', status:'success' });
      router.push('/admin/students');
    } finally {
      setSaving(false);
    }
  }

  async function captureSample() {
    if (!video || !faceReady) return;
    const emb = await getEmbeddingFor(video);
    if (!emb) { toast({ title:'Rosto não detectado', status:'warning' }); return; }
    setSamples(prev => [...prev, Array.from(emb) as number[]]);
  }

  return (
    <VStack align="stretch" spacing={6}>
      <PageCard>
        <VStack align="stretch" spacing={6}>
          <HStack>
            <Icon name='users' />
            <Text fontSize="xl" fontWeight={700}>Cadastro de aluno</Text>
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
              <Badge colorScheme={samples.length>=3?'green':'red'}>{samples.length>=3 ? `${samples.length} amostras` : 'mín. 3 amostras'}</Badge>
            </HStack>
          </HStack>
          <Text color="gray.600">Colete ao menos 3 amostras com boa iluminação, centralizando o rosto.</Text>
          {!!faceErr && <Text color='red.500' fontSize='sm'>{faceErr}</Text>}
          <VideoCanvas onReady={setVideo} />
          <LivenessHint ok={livenessOk} />
          <HStack>
            <Button variant='secondary' onClick={captureSample} isDisabled={!video || !faceReady}>Capturar amostra</Button>
            <Text color="gray.700">Amostras coletadas: {samples.length}/5</Text>
          </HStack>
        </VStack>
      </PageCard>

      <HStack justify="flex-end">
        <Button variant="ghost" onClick={()=>router.push('/admin/students')}>Cancelar</Button>
        <Button variant="secondary" onClick={save} isLoading={saving} isDisabled={samples.length<3}>Salvar</Button>
      </HStack>
    </VStack>
  );
}

