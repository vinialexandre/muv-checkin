"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { Button, Checkbox, CheckboxGroup, FormControl, FormErrorMessage, FormHelperText, FormLabel, HStack, Input, InputGroup, InputLeftAddon, Select, Stack, Text, VStack, useToast } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import * as yup from 'yup';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { IMaskInput } from 'react-imask';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlanBillingInterval, PlanPaymentMethod } from '@/lib/firestore';

function parseBRL(v: string): number {
  if (!v) return NaN;
  const n = v.replace(/[^0-9,.-]/g, '').replace(/\./g,'').replace(',', '.');
  return parseFloat(n);
}

const paymentMethodOptions: { value: PlanPaymentMethod; label: string }[] = [
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto bancário' },
];

const schema = yup.object({
  name: yup.string().trim().min(2,'Nome muito curto').required('Nome obrigatório'),
  priceStr: yup.string().required('Valor obrigatório').test('valid','Valor inválido', (val)=> !isNaN(parseBRL(val||'')) && parseBRL(val||'')>=0),
  period: yup.mixed<'monthly'|'quarterly'|'semiannual'|'annual'>()
    .oneOf(['monthly','quarterly','semiannual','annual'])
    .required('Período obrigatório'),
  billingInterval: yup.mixed<PlanBillingInterval>()
    .oneOf(['day','week','month','year'])
    .required('Intervalo obrigatório'),
  billingIntervalCount: yup.string()
    .required('Quantidade obrigatória')
    .test('positive-int','Informe um número maior que zero',(v)=>{
      const n = Number(v);
      return Number.isInteger(n) && n > 0 && n <= 12;
    }),
  paymentMethods: yup.array().of(yup.mixed<PlanPaymentMethod>().oneOf(['credit_card','pix','boleto'])).min(1,'Selecione pelo menos um método'),
  billingCycles: yup.string().optional().test('valid-cycle','Informe um número maior que zero', (v)=>{
    if (!v) return true;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n <= 120;
  }),
  active: yup.boolean().required(),
});
type FormData = yup.InferType<typeof schema>;

export default function NewPlanPage() {
  const router = useRouter();
  const toast = useToast();
  const { control, handleSubmit, formState:{ errors, isValid, isSubmitting } } = useForm<FormData>({
    mode:'onBlur',
    reValidateMode:'onChange',
    resolver: yupResolver(schema) as any,
    defaultValues:{
      name:'',
      priceStr:'',
      period:'monthly',
      billingInterval:'month',
      billingIntervalCount:'1',
      paymentMethods:['credit_card'],
      billingCycles:'',
      active: true,
    }
  });

  const save = handleSubmit(async (data)=>{
    const price = parseBRL(data.priceStr);
    const billingIntervalCount = Number(data.billingIntervalCount);
    const billingCycles = data.billingCycles ? Number(data.billingCycles) : undefined;

    const payload: Record<string, any> = {
      name: data.name,
      price,
      period: data.period,
      active: !!data.active,
      billingInterval: data.billingInterval,
      billingIntervalCount,
      paymentMethods: data.paymentMethods,
      planSyncStatus: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (billingCycles) payload.billingCycles = billingCycles;

    await addDoc(collection(db,'plans'), payload);
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
        <VStack spacing={4} align="stretch">
          <Controller name="name" control={control} render={({ field }) => (
            <FormControl isInvalid={!!errors.name} isRequired>
              <FormLabel>Nome</FormLabel>
              <Input placeholder="Plano recorrente" {...field} />
              <FormErrorMessage>{errors.name?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
          <HStack spacing={4} wrap="wrap">
            <Controller name="priceStr" control={control} render={({ field }) => (
              <FormControl isInvalid={!!errors.priceStr} isRequired maxW="240px">
                <FormLabel>Valor</FormLabel>
                <InputGroup>
                  <InputLeftAddon>R$</InputLeftAddon>
                  <Input as={IMaskInput as any} mask={Number} scale={2} padFractionalZeros={true} thousandsSeparator="." radix="," placeholder="0,00" value={field.value as any} onAccept={(v:any)=>field.onChange(v)} />
                </InputGroup>
                <FormErrorMessage>{errors.priceStr?.message as any}</FormErrorMessage>
              </FormControl>
            )}/>
            <Controller name="period" control={control} render={({ field }) => (
              <FormControl isInvalid={!!errors.period} isRequired maxW="220px">
                <FormLabel>Etiqueta do período</FormLabel>
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
              <FormControl isRequired maxW="140px">
                <FormLabel>Status</FormLabel>
                <Checkbox isChecked={!!field.value} onChange={(e)=>field.onChange(e.target.checked)}>Ativo</Checkbox>
              </FormControl>
            )}/>
          </HStack>
          <HStack spacing={4} wrap="wrap">
            <Controller name="billingInterval" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired maxW="220px">
                <FormLabel>Intervalo de cobrança</FormLabel>
                <Select placeholder="Selecione" {...field}>
                  <option value="day">Diário</option>
                  <option value="week">Semanal</option>
                  <option value="month">Mensal</option>
                  <option value="year">Anual</option>
                </Select>
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )}/>
            <Controller name="billingIntervalCount" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired maxW="220px">
                <FormLabel>Repetir a cada</FormLabel>
                <Input type="number" min={1} max={12} {...field} />
                <FormHelperText>P. ex.: 1 = a cada mês.</FormHelperText>
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )}/>
            <Controller name="billingCycles" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} maxW="220px">
                <FormLabel>Ciclos máximos</FormLabel>
                <Input type="number" min={1} max={120} placeholder="Indefinido" {...field} />
                <FormHelperText>Deixe em branco para recorrência contínua.</FormHelperText>
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )}/>
          </HStack>
          <Controller name="paymentMethods" control={control} render={({ field, fieldState }) => (
            <FormControl isInvalid={!!fieldState.error} isRequired>
              <FormLabel>Métodos de pagamento aceitos</FormLabel>
              <CheckboxGroup value={(field.value || []) as string[]} onChange={(vals)=>field.onChange(vals as PlanPaymentMethod[])}>
                <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
                  {paymentMethodOptions.map((opt) => (
                    <Checkbox key={opt.value} value={opt.value}>{opt.label}</Checkbox>
                  ))}
                </Stack>
              </CheckboxGroup>
              <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
            </FormControl>
          )}/>
        </VStack>
        <HStack justify="flex-end">
          <Button variant="ghost" onClick={()=>router.push('/admin/plans')}>Cancelar</Button>
          <Button variant="secondary" onClick={save} isDisabled={!isValid || isSubmitting} isLoading={isSubmitting}>Salvar</Button>
        </HStack>
      </VStack>
    </PageCard>
  );
}
