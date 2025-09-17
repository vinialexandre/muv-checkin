"use client";
import { auth } from '@/lib/firebase';
import { Spinner, Stack, Text } from '@chakra-ui/react';
import { onAuthStateChanged } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace('/login'); return; }
      const idt = await user.getIdTokenResult(true);
      const role = (idt.claims as any).role || (idt.claims.admin ? 'admin' : undefined);
      const isPrivileged = role === 'admin' || role === 'developer';
      const isAttendantAllowed = role === 'attendant' && (pathname?.startsWith('/admin/students') || pathname?.startsWith('/admin/kiosk'));
      if (!isPrivileged && !isAttendantAllowed) { router.replace('/login'); return; }
      setReady(true);
    });
    return () => unsub();
  }, [router, pathname]);
  if (!ready) return <Stack align="center" mt={10}><Spinner /><Text>Carregando…</Text></Stack>;
  return <>{children}</>;
}
