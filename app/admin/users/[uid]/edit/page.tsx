"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { Button, HStack, Input, Select, Text, VStack, useToast, FormControl, FormErrorMessage } from '@chakra-ui/react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const schema = yup.object({
  displayName: yup.string().trim().min(2,'Nome muito curto').required('Nome obrigatório'),
  role: yup.mixed<'admin'|'developer'|'attendant'>().oneOf(['admin','developer','attendant']).required(),
});

type FormData = yup.InferType<typeof schema>;

export default function EditUserPage() {
  const params = useParams();
  const uid = params?.uid as string;
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');

  const { control, handleSubmit, reset, formState: { isValid, isSubmitting, errors } } = useForm<FormData>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    resolver: yupResolver(schema),
    defaultValues: { displayName: '', role: 'attendant' }
  });

  useEffect(()=>{
    async function load() {
      try {
        const res = await fetch(`/api/users/get?uid=${uid}`);
        if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b?.error || `Erro ${res.status}`); }
        const data = await res.json();
        reset({ displayName: data.user?.displayName || '', role: (data.user?.role as any) || 'attendant' });
        setEmail(data.user?.email || '');
      } catch (e:any) {
        toast({ title:'Erro ao carregar', description: String(e?.message||e), status:'error' });
      }
    }
    load();
  }, [uid, reset, toast]);

  const save = handleSubmit(async (data)=>{
    const res = await fetch('/api/users/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ uid, ...data }) });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b?.error || `Erro ${res.status}`); }
    toast({ title:'Usuário atualizado', status:'success' });
    router.push('/admin/users');
  }, ()=> toast({ title:'Formulário inválido', status:'error' }));

  return (
    <PageCard>
      <VStack align="stretch" spacing={6}>
        <HStack>
          <Icon name='user' />
          <Text fontSize="xl" fontWeight={700}>Edição de usuário</Text>
        </HStack>
        <HStack spacing={3} wrap="wrap">
          <Controller name="displayName" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.displayName} isRequired>
              <Input borderRadius="md" placeholder="Nome" {...field} />
              <FormErrorMessage>{errors.displayName?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Input borderRadius="md" placeholder="Email" type="email" value={email} isDisabled />
          <Controller name="role" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.role} isRequired>
            <Select borderRadius="md" {...field}>
              <option value="admin">Administrador</option>
              <option value="attendant">Atendente</option>
              <option value="developer">Desenvolvedor</option>
            </Select>
              <FormErrorMessage>{errors.role?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
        </HStack>
        <HStack justify="flex-end">
          <Button variant="ghost" borderRadius="md" onClick={()=>router.push('/admin/users')}>Cancelar</Button>
          <Button variant="secondary" borderRadius="md" onClick={save} isDisabled={!isValid || isSubmitting} isLoading={isSubmitting}>Salvar</Button>
        </HStack>
      </VStack>
    </PageCard>
  );
}
