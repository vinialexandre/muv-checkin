"use client";
import { auth } from '@/lib/firebase';
import { Button, Card, CardBody, FormControl, FormLabel, Heading, Input, Stack, Text } from '@chakra-ui/react';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string|undefined>();
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const idt = await user.getIdTokenResult(true);
      const claims = idt.claims as any;
      const role = claims.role || (claims.admin ? 'admin' : undefined);
      if (role === 'admin' || role === 'developer') router.replace('/admin/students');
      else if (role === 'attendant') router.replace('/admin/students');
      else setError('Seu usuário não possui acesso. Peça para um admin definir seu papel.');
    });
    return () => unsub();
  }, [router]);

  const submit = async () => {
    setError(undefined);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idt = await cred.user.getIdTokenResult(true);
      const claims = idt.claims as any;
      const role = claims.role || (claims.admin ? 'admin' : undefined);
      if (role === 'admin' || role === 'developer') router.replace('/admin/students');
      else if (role === 'attendant') router.replace('/admin/students');
      else setError('Seu usuário não possui acesso. Peça para um admin definir seu papel.');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Stack align="center" mt={24}>
      <Card w="sm" variant="outline">
        <CardBody>
          <Heading size="md" mb={4}>Acesso Admin</Heading>
          <FormControl mb={3}>
            <FormLabel>Email</FormLabel>
            <Input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" />
          </FormControl>
          <FormControl mb={4}>
            <FormLabel>Senha</FormLabel>
            <Input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" />
          </FormControl>
          {error && <Text color="red.500" mb={2}>{error}</Text>}
          <Button onClick={submit} w="full">Entrar</Button>
        </CardBody>
      </Card>
    </Stack>
  );
}
