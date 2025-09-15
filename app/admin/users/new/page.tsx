"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { Button, HStack, Input, Select, Text, VStack, useToast, FormControl, FormErrorMessage, InputGroup, InputRightElement, IconButton } from '@chakra-ui/react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
// no mask for email to avoid runtime issues; validation handles it

function normalizeEmail(v: string) { return v.replace(/\s+/g,'').toLowerCase(); }

const schema = yup.object({
  displayName: yup.string().trim().min(2,'Nome muito curto').required('Nome obrigatório'),
  email: yup.string().transform(v=>normalizeEmail(String(v||''))).email('Email inválido').required('Email obrigatório'),
  password: yup.string().min(6,'Senha mínima de 6').required('Senha obrigatória'),
  role: yup.mixed<'admin'|'developer'|'attendant'>().oneOf(['admin','developer','attendant']).required(),
});

type FormData = yup.InferType<typeof schema>;

export default function NewUserPage() {
  const router = useRouter();
  const toast = useToast();
  const [showPw, setShowPw] = useState(false);
  const { control, handleSubmit, formState: { isValid, isSubmitting, errors } } = useForm<FormData>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    resolver: yupResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', role: 'attendant' },
  });

  const save = handleSubmit(async (data) => {
    const payload = { ...data, email: normalizeEmail(data.email) };
    const res = await fetch('/api/users/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b?.error || `Erro ${res.status}`); }
    toast({ title:'Usuário criado', status:'success' });
    router.push('/admin/users');
  }, (e)=>{ toast({ title:'Formulário inválido', status:'error' }); });

  return (
    <PageCard>
      <VStack align="stretch" spacing={6}>
        <HStack>
          <Icon name='user' />
          <Text fontSize="xl" fontWeight={700}>Cadastro de usuário</Text>
        </HStack>
        <HStack spacing={3} wrap="wrap">
          <Controller name="displayName" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.displayName} isRequired>
              <Input borderRadius="md" placeholder="Nome" {...field} />
              <FormErrorMessage>{errors.displayName?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="email" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.email} isRequired>
              <Input
                {...field}
                borderRadius="md"
                placeholder="Email"
                type="email"
                onChange={(e)=>field.onChange(normalizeEmail(e.target.value))}
              />
              <FormErrorMessage>{errors.email?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="password" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.password} isRequired>
              <InputGroup>
                <Input borderRadius="md" placeholder="Senha" type={showPw ? 'text' : 'password'} {...field} />
                <InputRightElement>
                  <IconButton aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'} size="sm" variant="ghost" onClick={()=>setShowPw(v=>!v)} icon={showPw ? <EyeOff size={16}/> : <Eye size={16}/>} />
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage>{errors.password?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
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
