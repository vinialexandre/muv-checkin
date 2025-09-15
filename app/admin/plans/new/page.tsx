"use client";
import PageCard from '@/components/PageCard';
import { Button, FormControl, FormErrorMessage, HStack, Input, InputGroup, InputLeftAddon, Text, VStack, useToast } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import * as yup from 'yup';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { IMaskInput } from 'react-imask';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function parseBRL(v: string): number {
  if (!v) return NaN;
  const n = v.replace(/[^0-9,.-]/g, '').replace(/\./g,'').replace(',', '.');
  return parseFloat(n);
}

const schema = yup.object({
  name: yup.string().trim().min(2,'Nome muito curto').required('Nome obrigatório'),
  priceStr: yup.string().required('Valor obrigatório').test('valid','Valor inválido', (val)=> !isNaN(parseBRL(val||'')) && parseBRL(val||'')>=0),
});
type FormData = yup.InferType<typeof schema>;

export default function NewPlanPage() {
  const router = useRouter();
  const toast = useToast();
  const { control, handleSubmit, formState:{ errors, isValid, isSubmitting } } = useForm<FormData>({
    mode:'onBlur', reValidateMode:'onBlur', resolver: yupResolver(schema), defaultValues:{ name:'', priceStr:'' }
  });

  const save = handleSubmit(async (data)=>{
    const price = parseBRL(data.priceStr);
    await addDoc(collection(db,'plans'), { name: data.name, price });
    toast({ title:'Plano criado', status:'success' });
    router.push('/admin/plans');
  });

  return (
    <PageCard>
      <VStack align="stretch" spacing={4}>
        <Text fontSize="lg" fontWeight={600}>Cadastro de plano</Text>
        <HStack spacing={3} wrap="wrap">
          <Controller name="name" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.name} isRequired>
              <Input placeholder="Nome" {...field} />
              <FormErrorMessage>{errors.name?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="priceStr" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.priceStr} isRequired>
              <InputGroup>
                <InputLeftAddon children="R$" />
                <Input as={IMaskInput as any} mask={Number} scale={2} thousandsSeparator="." radix="," placeholder="0,00" value={field.value as any} onAccept={(v:any)=>field.onChange(v)} />
              </InputGroup>
              <FormErrorMessage>{errors.priceStr?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
        </HStack>
        <HStack justify="flex-end">
          <Button variant="ghost" onClick={()=>router.push('/admin/plans')}>Cancelar</Button>
          <Button colorScheme="blue" onClick={save} isDisabled={!isValid || isSubmitting} isLoading={isSubmitting}>Salvar</Button>
        </HStack>
      </VStack>
    </PageCard>
  );
}


