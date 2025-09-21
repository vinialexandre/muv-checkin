"use client";
import { auth } from '@/lib/firebase';
import { Button, Card, CardBody, FormControl, FormLabel, Heading, Input, Stack, useToast, Image } from '@chakra-ui/react';
import { ptAuthMessage } from '@/lib/errors';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [, setError] = useState<string|undefined>();
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const idt = await user.getIdTokenResult(true);
      const claims = idt.claims as any;
      const role = claims.role || (claims.admin ? 'admin' : undefined);
      if (role === 'admin' || role === 'developer') router.replace('/admin/students');
      else if (role === 'attendant') router.replace('/admin/students');
      else { setError('Seu usuário não possui acesso. Peça para um admin definir seu papel.'); toast({ status:'error', title:'Acesso negado', description:'Seu usuário não possui papel com acesso.' }); }
    });
    return () => unsub();
  }, [router]);

  const submit = async () => {
    setError(undefined);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idt = await cred.user.getIdTokenResult(true);
      const claims = idt.claims as any;
      const role = claims.role || (claims.admin ? 'admin' : undefined);
      toast({ status:'success', title:'Login realizado', description:'Bem-vindo!' });
      if (role === 'admin' || role === 'developer') router.replace('/admin/students');
      else if (role === 'attendant') router.replace('/admin/students');
      else { setError('Seu usuário não possui acesso. Peça para um admin definir seu papel.'); toast({ status:'error', title:'Acesso negado', description:'Seu usuário não possui papel com acesso.' }); }
    } catch (e: any) {
      const msg = ptAuthMessage(e?.code);
      setError(msg);
      toast({ status:'error', title:'Erro no login', description: msg, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };


  const forgot = async () => {
    setError(undefined);
    if (!email) { const msg='Informe seu email para recuperar a senha.'; setError(msg); toast({ status:'error', title:'Recuperação de senha', description: msg }); return; }
    try {
      // Configurar para usar nossa página customizada de redefinição
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      toast({
        title: 'Email de recuperação enviado',
        description: 'Verifique sua caixa de entrada e spam.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (e: any) {
      const errorMessage = ptAuthMessage(e?.code) || 'Erro ao enviar email de recuperação.';
      setError(errorMessage);
      toast({ status:'error', title:'Recuperação de senha', description: errorMessage, isClosable: true });
    }
  };

  return (
    <Stack align="center" minH="100vh" justify="center" py={8}>
      <Image src="/logo-muv.png" alt="MUV" h="165px" mt="-230px" mb="-7px" />
      <Card w="sm" variant="outline">
        <CardBody as="form" onSubmit={onSubmit}>
          <Heading size="md" textAlign={"center"} mb={4}>Plataforma de Gestão</Heading>
          <FormControl mb={3}>
            <FormLabel>Email</FormLabel>
            <Input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" isDisabled={loading} />
          </FormControl>
          <FormControl mb={4}>
            <FormLabel>Senha</FormLabel>
            <Input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" isDisabled={loading} />
          </FormControl>
          <Button variant="link" size="sm" onClick={forgot} mb={2} type="button" isDisabled={loading}>Esqueceu a senha?</Button>
          <Button type="submit" w="full" isLoading={loading} isDisabled={loading}>Entrar</Button>
        </CardBody>
      </Card>
    </Stack>
  );
}
