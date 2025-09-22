"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { Button, Checkbox, FormControl, FormErrorMessage, FormLabel, HStack, Input, InputGroup, InputLeftAddon, Select, Text, VStack, useToast } from '@chakra-ui/react';
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
  period: yup.mixed<'monthly'|'quarterly'|'semiannual'|'annual'>().oneOf(['monthly','quarterly','semiannual','annual']).required('Período obrigatório'),
  active: yup.boolean().required(),
});
type FormData = yup.InferType<typeof schema>;

export default function NewPlanPage() {
  const router = useRouter();
  const toast = useToast();
  const { control, handleSubmit, formState:{ errors, isValid, isSubmitting } } = useForm<FormData>({
    mode:'onBlur', reValidateMode:'onBlur', resolver: yupResolver(schema), defaultValues:{ name:'', priceStr:'', period:'monthly', active: true }
  });

  const save = handleSubmit(async (data)=>{
    const price = parseBRL(data.priceStr);
    await addDoc(collection(db,'plans'), { name: data.name, price, period: data.period, active: !!data.active });
    toast({ title:'Plano criado', status:'success' });
    router.push('/admin/plans');
  });

  return (
    <PageCard>
      <VStack align="stretch" spacing={6}>
        <HStack>
          <Icon name='folder' />
          <Text fontSize="xl" fontWeight={700}>Cadastro de plano</Text>
        </HStack>
        <HStack spacing={3} wrap="wrap">
          <Controller name="name" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.name} isRequired>
              <Input placeholder="Nome" {...field} />
              <FormErrorMessage>{errors.name?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="priceStr" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.priceStr} isRequired>
              <FormLabel>Valor</FormLabel>
              <InputGroup>
                <InputLeftAddon children="R$" />
                <Input as={IMaskInput as any} mask={Number} scale={2} padFractionalZeros={true} thousandsSeparator="." radix="," placeholder="0,00" value={field.value as any} onAccept={(v:any)=>field.onChange(v)} />
              </InputGroup>
              <FormErrorMessage>{errors.priceStr?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="period" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.period} isRequired>
              <FormLabel>Período</FormLabel>
              <Select {...field}>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="semiannual">Semestral</option>
                <option value="annual">Anual</option>
              </Select>
              <FormErrorMessage>{(errors as any).period?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <Controller name="active" control={control} render={({ field }) => (
            <FormControl isRequired>
              <Checkbox isChecked={!!field.value} onChange={(e)=>field.onChange(e.target.checked)}>Ativo</Checkbox>
            </FormControl>
          )}/>

        </HStack>
        <HStack justify="flex-end">
          <Button variant="ghost" onClick={()=>router.push('/admin/plans')}>Cancelar</Button>
          <Button variant="secondary" onClick={save} isDisabled={!isValid || isSubmitting} isLoading={isSubmitting}>Salvar</Button>
        </HStack>
      </VStack>
    </PageCard>
  );
}


