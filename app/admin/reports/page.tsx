"use client";
import { exportAttendancesCsvForMonth } from '@/lib/firestore';
import { Button, HStack, Input, Text, VStack } from '@chakra-ui/react';
import { useState } from 'react';

export default function ReportsPage() {
  const [month, setMonth] = useState<string>('');
  const [csv, setCsv] = useState<string>('');
  async function run() {
    if (!month) return;
    const [y,m] = month.split('-').map(Number);
    const out = await exportAttendancesCsvForMonth(y, m-1);
    setCsv(out);
  }
  return (
    <VStack align="stretch" spacing={6}>
      <HStack>
        <Input type="month" value={month} onChange={(e)=>setMonth(e.target.value)} />
        <Button onClick={run}>Exportar CSV</Button>
      </HStack>
      {csv && (
        <>
          <Text>{csv.split('\n').length-1} registros</Text>
          <pre style={{ whiteSpace:'pre-wrap' }}>{csv}</pre>
        </>
      )}
    </VStack>
  );
}

