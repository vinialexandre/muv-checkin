"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Box, Button, Heading, HStack, Select, Stat, StatLabel, StatNumber, Text, VStack } from '@chakra-ui/react';
import VideoCanvas from '@/components/VideoCanvas';
import LivenessHint from '@/components/LivenessHint';
import { useFaceModels } from '@/lib/face/useFaceModels';
import { getEmbeddingFor, match1vN } from '@/lib/face/match1vN';
import { createCheckIn } from '@/lib/firestore';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PageCard from '@/components/PageCard';
import { simpleLiveness } from '@/lib/face/liveness';

export default function KioskPage() {
  const { ready, error: faceError, loading: faceLoading } = useFaceModels();
  const [students, setStudents] = useState<any[]>([]);
  const [last, setLast] = useState<{name:string; id:string; at: Date; success?: boolean} | null>(null);
  const [livenessOk, setLivenessOk] = useState(false);
  const [manualStudentId, setManualStudentId] = useState<string>('');
  const lastProcessRef = useRef<number>(0);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const videoRef = useRef<HTMLVideoElement|null>(null);
  useEffect(() => {
    getDocs(collection(db,'students')).then(s => setStudents(s.docs.map(d=>({ id:d.id, ...(d.data() as any) }))));
  }, []);

  async function processFrame(video: HTMLVideoElement) {
    if (!ready) return;

    // Update liveness state every tick (cheap vs detection)
    let isLive = false;
    try {
      const lv = await simpleLiveness(video);
      isLive = !!lv.ok;
      setLivenessOk(isLive);
    } catch {}

    // Throttle heavy face descriptor extraction
    const nowTs = Date.now();
    const throttleMs = 900;
    if (nowTs - (lastProcessRef.current || 0) < throttleMs) return;
    lastProcessRef.current = nowTs;

    // Only try recognize if liveness OK
    if (!isLive) return;

    const emb = await getEmbeddingFor(video);
    if (!emb) return;

    // Build face index of active students with centroid/descriptors present
    const faceIndex = (students||[])
      .filter((s:any)=> (s.active ?? true) && (s.centroid || (s.descriptors && s.descriptors.length)))
      .map((s:any)=> ({ id: s.id, name: s.name, centroid: s.centroid, descriptors: (s.descriptors||[]).map((d:any)=> Array.isArray(d) ? d : d?.v).filter(Boolean) }));
    if (!faceIndex.length) return;

    const match = match1vN(emb, faceIndex as any);
    if (!('matched' in match) || !match.matched) return;

    // Cooldown per-student to avoid spamming
    const cooldownMs = 20_000;
    const lastSeen = cooldownRef.current.get(match.studentId) || 0;
    if (nowTs - lastSeen < cooldownMs) return;
    cooldownRef.current.set(match.studentId, nowTs);

    const now = new Date();
    const result = await createCheckIn({ studentId: match.studentId, when: now, source: 'face' });
    setLast({ name: match.name, id: match.studentId, at: now, success: result.created });
  }

  async function manualCheckIn() {
    if (!manualStudentId) return;
    const now = new Date();
    const s = students.find(s=>s.id===manualStudentId);
    const result = await createCheckIn({ studentId: manualStudentId, when: now, source: 'manual' });
    setLast({ name: s?.name || manualStudentId, id: manualStudentId, at: now, success: result.created });
    setManualStudentId(''); // Limpa a seleção após o check-in
  }

  return (
    <PageCard>
      <VStack spacing={6} align="stretch">
        <HStack>
          <Icon name='monitor' />
          <Heading size="lg">Kiosque</Heading>
        </HStack>
        <Text color="gray.700">Reconhecimento facial 1:N e check-in automático</Text>
        {faceLoading && <Text color="blue.500">🔄 Carregando modelos de reconhecimento facial...</Text>}
        {faceError && <Text color="red.500">❌ {faceError}</Text>}
        <VideoCanvas onReady={(v)=>{
          videoRef.current = v;
          const tick = async () => { if (videoRef.current) await processFrame(videoRef.current); requestAnimationFrame(tick); };
          tick();
        }} />
        <LivenessHint ok={livenessOk} />
        {last && (
          <HStack>
            <Stat>
              <StatLabel>Último check-in</StatLabel>
              <StatNumber>{last.name}</StatNumber>
              <Text fontSize="sm" color="gray.500">
                {last.at.toLocaleTimeString('pt-BR')}
              </Text>
            </Stat>
            {last.success === false && <Text color="orange.500">Check-in recente - não registrado novamente</Text>}
            {last.success === true && <Text color="green.500">✓ Check-in registrado com sucesso</Text>}
          </HStack>
        )}
        <Box>
          <Heading size="sm" mb={2}>Check-in manual (admin)</Heading>
          <HStack>
            <Select placeholder="Aluno" value={manualStudentId} onChange={(e)=>setManualStudentId(e.target.value)}>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Button onClick={manualCheckIn} variant="secondary">Check-in</Button>
          </HStack>
        </Box>
        <Text fontSize="sm" color="gray.500">
          Sistema simplificado - não requer aulas cadastradas. Check-ins são registrados automaticamente.
        </Text>
      </VStack>
    </PageCard>
  );
}
