"use client";
import { Alert, AlertIcon, HStack, Text } from '@chakra-ui/react';

export default function LivenessHint({ ok, late }: { ok: boolean; late?: boolean }) {
  if (ok) return <Alert status="success" variant="subtle"><AlertIcon />Liveness OK</Alert>;
  return (
    <Alert status={late ? 'warning' : 'info'} variant="subtle">
      <AlertIcon /> Pisque e vire levemente o rosto
    </Alert>
  );
}

