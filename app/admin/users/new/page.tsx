"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { Button, Checkbox, HStack, Input, Select, Text, VStack, useToast, FormControl, FormLabel, FormErrorMessage, InputGroup, InputRightElement, IconButton } from '@chakra-ui/react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
// no mask for email to avoid runtime issues; validation handles it

function normalizeEmail(v: string) { return v.replace(/\s+/g,'').toLowerCase(); }

const usernameRegex = /^[a-z0-9._-]{3,30}$/;
const schema = yup.object({
  displayName: yup.string().trim().min(2,'Nome muito curto').required('Nome obrigatório'),
  username: yup.string().trim().transform(v=>String(v||'').toLowerCase())
    .matches(usernameRegex,'Use apenas letras minúsculas, números, ponto, traço ou sublinhado (3–30)')
    .required('Usuário obrigatório'),
  email: yup.string()
    .transform(v=>{ const s = normalizeEmail(String(v||'')); return s==='' ? undefined as any : s; })
    .email('Email inválido')
    .optional(),
  password: yup.string().min(6,'Senha mínima de 6').required('Senha obrigatória'),
  role: yup.mixed<'admin'|'developer'|'attendant'>().oneOf(['admin','developer','attendant']).required(),
  active: yup.boolean().required(),
});

type FormData = yup.InferType<typeof schema>;

export default function NewUserPage() {
  const router = useRouter();
  const toast = useToast();
  const [showPw, setShowPw] = useState(false);
  const { control, handleSubmit, formState: { isValid, isSubmitting, errors } } = useForm<FormData>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    resolver: yupResolver(schema) as any,
    defaultValues: { displayName: '', username: '', email: '', password: '', role: 'attendant', active: true },
  });

  const save = handleSubmit(async (data) => {
    const emailNorm = normalizeEmail(String((data as any).email||''));
    const payload: any = { displayName: data.displayName, username: String((data as any).username||'').toLowerCase(), active: !!data.active, password: data.password, role: (data as any).role };
    if (emailNorm) payload.email = emailNorm;
    const res = await fetch('/api/users/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b?.error || `Erro ${res.status}`); }
    toast({ title:'Usuário criado', status:'success' });
    router.push('/admin/users');
  }, ()=>{ toast({ title:'Formulário inválido', status:'error' }); });

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
              <FormLabel>Nome</FormLabel>
              <Input borderRadius="md" placeholder="Nome" {...field} />
              <FormErrorMessage>{errors.displayName?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>

          <Controller name="username" control={control} render={({ field }) => (
            <FormControl isInvalid={!!(errors as any).username} isRequired>
              <FormLabel>Usuário</FormLabel>
              <Input borderRadius="md" placeholder="Usuario" {...field} onChange={(e)=>field.onChange(e.target.value.toLowerCase())} />
              <FormErrorMessage>{(errors as any).username?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>


          <Controller name="email" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.email}>
              <FormLabel>Email</FormLabel>
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
              <FormLabel>Senha</FormLabel>
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
  );
}
