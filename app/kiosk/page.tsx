"use client";
import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Heading, HStack, Select, Stat, StatLabel, StatNumber, Text, VStack } from '@chakra-ui/react';
import VideoCanvas from '@/components/VideoCanvas';
import LivenessHint from '@/components/LivenessHint';
import { loadFaceModels } from '@/lib/face/loadModels';
import { getEmbeddingFor, match1vN } from '@/lib/face/match1vN';
import { canCheckInWindow, createAttendanceOnce } from '@/lib/firestore';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function KioskPage() {
  const [ready, setReady] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [last, setLast] = useState<{name:string; id:string; at: Date; warnLate?: boolean} | null>(null);
  const [classId, setClassId] = useState<string>('');
  const [livenessOk, setLivenessOk] = useState(false);
  const [manualStudentId, setManualStudentId] = useState<string>('');

  useEffect(() => { loadFaceModels().then(()=>setReady(true)); }, []);
  useEffect(() => { getDocs(collection(db,'students')).then(s => setStudents(s.docs.map(d=>({ id:d.id, ...(d.data() as any) })))); }, []);
  useEffect(() => { getDocs(collection(db,'classes')).then(s => { const now = new Date(); const current = s.docs.find(d => {
    const st = (d.data() as any).startsAt.toDate(); const en = (d.data() as any).endsAt.toDate(); return now>=new Date(st.getTime()-10*60*1000) && now<=new Date(st.getTime()+15*60*1000);
  }); if (current) setClassId(current.id); }); }, []);

  async function onFrame(video: HTMLVideoElement) {
    if (!ready || !classId) return;
    const emb = await getEmbeddingFor(video);
    if (!emb) return;
    const match = match1vN(emb, students);
    if (!('matched' in match) || !match.matched) return;
    const now = new Date();
    const windowOk = await canCheckInWindow(classId, now);
    const res = await createAttendanceOnce({ classId, studentId: match.studentId, when: now, source: 'face' });
    setLast({ name: match.name, id: match.studentId, at: now, warnLate: !windowOk });
  }

  async function manualCheckIn() {
    if (!manualStudentId || !classId) return;
    const now = new Date();
    const s = students.find(s=>s.id===manualStudentId);
    await createAttendanceOnce({ classId, studentId: manualStudentId, when: now, source: 'manual' });
    setLast({ name: s?.name || manualStudentId, id: manualStudentId, at: now });
  }

  return (
    <VStack p={6} spacing={6} align="stretch">
      <Heading size="md">Kiosque</Heading>
      <Text>Reconhecimento facial 1:N e check-in automático</Text>
      <VideoCanvas onReady={(v)=>{
        const tick = async () => { await onFrame(v); requestAnimationFrame(tick); };
        tick();
      }} />
      <LivenessHint ok={livenessOk} />
      {last && (
        <HStack>
          <Stat>
            <StatLabel>Último check-in</StatLabel>
            <StatNumber>{last.name}</StatNumber>
          </Stat>
          {last.warnLate && <Text color="red.500">Fora da janela - registrado mesmo assim</Text>}
        </HStack>
      )}
      <Box>
        <Heading size="sm" mb={2}>Check-in manual (admin)</Heading>
        <HStack>
          <Select placeholder="Aluno" value={manualStudentId} onChange={(e)=>setManualStudentId(e.target.value)}>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button onClick={manualCheckIn} variant="outline">Check-in</Button>
        </HStack>
      </Box>
      <Text fontSize="sm" color="gray.500">Se necessário, faça check-in manual pelo admin.</Text>
    </VStack>
  );
}
