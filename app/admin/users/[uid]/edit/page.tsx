"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { Box, Button, Checkbox, Flex, HStack, Input, Select, Spinner, Text, VStack, useToast, FormControl, FormErrorMessage, FormLabel } from '@chakra-ui/react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const usernameRegex = /^[a-z0-9._-]{3,30}$/;
const schema = yup.object({
  displayName: yup.string().trim().min(2,'Nome muito curto').required('Nome obrigatório'),
  username: yup.string().trim().transform(v=>String(v||'').toLowerCase())
    .matches(usernameRegex,'Use apenas letras minúsculas, números, ponto, traço ou sublinhado (3–30)')
    .required('Usuário obrigatório'),
  role: yup.mixed<'admin'|'developer'|'attendant'>().oneOf(['admin','developer','attendant']).required(),
  active: yup.boolean().required(),
  newPassword: yup.string().optional().test('len','Senha mínima de 6', (v)=>!v || v.length>=6),
  confirmPassword: yup.string().optional().test('match','As senhas não coincidem', function(v){ return !this.parent.newPassword || v===this.parent.newPassword; }),
});

type FormData = yup.InferType<typeof schema>;

export default function EditUserPage() {
  const params = useParams();
  const uid = params?.uid as string;
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');

  const [loadingPage, setLoadingPage] = useState(true);
  const { control, handleSubmit, reset, formState: { isValid, isSubmitting, errors } } = useForm<FormData>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    resolver: yupResolver(schema) as any,
    defaultValues: { displayName: '', username: '', role: 'attendant', active: true, newPassword: '', confirmPassword: '' }
  });

  useEffect(()=>{
    async function load() {
      try {
        setLoadingPage(true);
        const res = await fetch(`/api/users/get?uid=${uid}`);
        if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b?.error || `Erro ${res.status}`); }
        const data = await res.json();
        reset({ displayName: data.user?.displayName || '', username: (data.user?.username||'') as any, role: (data.user?.role as any) || 'attendant', active: (data.user?.active ?? true), newPassword: '', confirmPassword: '' });
        setEmail(data.user?.email || '');
      } catch (e:any) {
        toast({ title:'Erro ao carregar', description: String(e?.message||e), status:'error' });
      } finally {
        setLoadingPage(false);
      }
    }
    load();
  }, [uid, reset, toast]);

  const save = handleSubmit(async (data)=>{
    const payload: any = { uid, displayName: data.displayName, role: (data as any).role, active: !!(data as any).active, username: String((data as any).username||'').toLowerCase() };
    const emailNorm = String(email||'').trim().toLowerCase();
    if (emailNorm) payload.email = emailNorm;
    if ((data as any).newPassword) payload.password = (data as any).newPassword;
    const res = await fetch('/api/users/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b?.error || `Erro ${res.status}`); }
    toast({ title:'Usuário atualizado', status:'success' });
    router.push('/admin/users');
  }, ()=> toast({ title:'Formulário inválido', status:'error' }));

  return (
    <>
      {loadingPage && (
        <Flex position="fixed" inset={0} zIndex={1000} align="center" justify="center" bg="rgba(0,0,0,0.28)">
          <Box bg="white" px={4} py={2} borderRadius="md" boxShadow="lg">
            <HStack spacing={3}><Spinner size="sm" /><Text fontWeight={600}>Carregando...</Text></HStack>
          </Box>
        </Flex>
      )}
      <PageCard>
        <VStack align="stretch" spacing={6}>
        <HStack>
          <Icon name='user' />
          <Text fontSize="xl" fontWeight={700}>Edição de usuário</Text>
        </HStack>
        <HStack spacing={3} wrap="wrap">
          <Controller name="displayName" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.displayName} isRequired>
              <FormLabel>Nome</FormLabel>
              <Input borderRadius="md" placeholder="Nome" {...field} />
              <FormErrorMessage>{errors.displayName?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="username" control={control} render={({ field }) => (
            <FormControl isInvalid={!!(errors as any).username} isRequired>
              <FormLabel>Usuário</FormLabel>
              <Input borderRadius="md" placeholder="Usuário" {...field} onChange={(e)=>field.onChange(e.target.value.toLowerCase())} />
              <FormErrorMessage>{(errors as any).username?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>

          <FormControl>
            <FormLabel>Email (opcional)</FormLabel>
            <Input borderRadius="md" placeholder="Email (opcional)" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </FormControl>
          <Controller name="newPassword" control={control} render={({ field }) => (
            <FormControl isInvalid={!!(errors as any).newPassword}>
              <FormLabel>Nova senha</FormLabel>
              <Input borderRadius="md" placeholder="Nova senha" type="password" {...field} />
              <FormErrorMessage>{(errors as any).newPassword?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="confirmPassword" control={control} render={({ field }) => (
            <FormControl isInvalid={!!(errors as any).confirmPassword}>
              <FormLabel>Confirmar senha</FormLabel>
              <Input borderRadius="md" placeholder="Confirmar senha" type="password" {...field} />
              <FormErrorMessage>{(errors as any).confirmPassword?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>

          <Controller name="role" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.role} isRequired>
              <FormLabel>Papel</FormLabel>
              <Select borderRadius="md" {...field}>
                <option value="admin">Administrador</option>
                <option value="attendant">Atendente</option>
                <option value="developer">Desenvolvedor</option>
              </Select>
              <FormErrorMessage>{errors.role?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="active" control={control} render={({ field }) => (
            <FormControl isRequired>
              <FormLabel>Status</FormLabel>
              <Checkbox isChecked={!!field.value} onChange={(e)=>field.onChange(e.target.checked)}>Ativo</Checkbox>
            </FormControl>
          )}/>
        </HStack>
        <HStack justify="flex-end">
          <Button variant="ghost" borderRadius="md" onClick={()=>router.push('/admin/users')}>Cancelar</Button>
          <Button variant="secondary" borderRadius="md" onClick={save} isDisabled={!isValid || isSubmitting} isLoading={isSubmitting}>Salvar</Button>
        </HStack>
      </VStack>
    </PageCard>
    </>
  );
}
