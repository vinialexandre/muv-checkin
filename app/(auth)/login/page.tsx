"use client";
import { auth } from '@/lib/firebase';
import { Button, Card, CardBody, FormControl, FormLabel, Heading, Input, Stack, useToast, Image, InputGroup, InputRightElement, IconButton } from '@chakra-ui/react';
import { ptAuthMessage } from '@/lib/errors';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { useEffect, useState, FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [, setError] = useState<string|undefined>();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
      let emailToUse = email;
      if (!email.includes('@')) {
        const r = await fetch(`/api/auth/resolve-username?username=${encodeURIComponent(email)}`);
        if (!r.ok) { throw new Error('Usuário não encontrado'); }
        const j = await r.json();
        emailToUse = j.email || '';
      }
      const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
      const idt = await cred.user.getIdTokenResult(true);
      const claims = idt.claims as any;
      const role = claims.role || (claims.admin ? 'admin' : undefined);
      toast({ status:'success', title:'Login realizado', description:'Bem-vindo!' });
      if (role === 'admin' || role === 'developer') router.replace('/admin/students');
      else if (role === 'attendant') router.replace('/admin/students');
      else { setError('Seu usuário não possui acesso. Peça para um admin definir seu papel.'); toast({ status:'error', title:'Acesso negado', description:'Seu usuário não possui papel com acesso.' }); }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : ptAuthMessage(e?.code);
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
    if (!email) { const msg='Informe seu email ou usuário para recuperar a senha.'; setError(msg); toast({ status:'error', title:'Recuperação de senha', description: msg }); return; }
    try {
      const actionCodeSettings = { url: `${window.location.origin}/reset-password`, handleCodeInApp: true } as const;
      let emailToUse = email;
      if (!email.includes('@')) {
        const r = await fetch(`/api/auth/resolve-username?username=${encodeURIComponent(email)}`);
        if (!r.ok) throw new Error('Usuário não encontrado');
        const j = await r.json();
        emailToUse = j.email || '';
      }
      await sendPasswordResetEmail(auth, emailToUse, actionCodeSettings);
      toast({ title: 'Email de recuperação enviado', description: 'Verifique sua caixa de entrada e spam.', status: 'success', duration: 5000, isClosable: true });
    } catch (e: any) {
      const errorMessage = e?.message ? String(e.message) : (ptAuthMessage(e?.code) || 'Erro ao enviar email de recuperação.');
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
            <FormLabel>Email ou usuário</FormLabel>
            <Input value={email} onChange={(e)=>setEmail(e.target.value)} type="text" isDisabled={loading} />
          </FormControl>
          <FormControl mb={4}>
            <FormLabel>Senha</FormLabel>
            <InputGroup>
              <Input value={password} onChange={(e)=>setPassword(e.target.value)} type={showPw ? 'text' : 'password'} isDisabled={loading} />
              <InputRightElement>
                <IconButton aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'} size="sm" variant="ghost" onClick={()=>setShowPw(v=>!v)} icon={showPw ? <EyeOff size={16}/> : <Eye size={16}/>} />
              </InputRightElement>
            </InputGroup>
          </FormControl>
          <Button variant="link" size="sm" onClick={forgot} mb={2} type="button" isDisabled={loading}>Esqueceu a senha?</Button>
          <Button type="submit" w="full" isLoading={loading} isDisabled={loading}>Entrar</Button>
        </CardBody>
      </Card>
    </Stack>
  );
}
