"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { Button, Checkbox, CheckboxGroup, Flex, FormControl, FormErrorMessage, FormHelperText, FormLabel, HStack, Input, InputGroup, InputLeftAddon, Select, Spinner, Stack, Text, VStack, useToast } from '@chakra-ui/react';
import { useParams, useRouter } from 'next/navigation';
import * as yup from 'yup';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { IMaskInput } from 'react-imask';
import { db } from '@/lib/firebase';
import { deleteField, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { PlanBillingInterval, PlanPaymentMethod } from '@/lib/firestore';

function parseBRL(v: string): number {
  if (!v) return NaN;
  const n = v.replace(/[^0-9,.-]/g, '').replace(/\./g,'').replace(',', '.');
  return parseFloat(n);
}
function formatNumberPT(n: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const paymentMethodOptions: { value: PlanPaymentMethod; label: string }[] = [
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto bancário' },
];

const schema = yup.object({
  name: yup.string().trim().min(2,'Nome muito curto').required('Nome obrigatório'),
  priceStr: yup.string().required('Valor obrigatório').test('valid','Valor inválido', (val)=> !isNaN(parseBRL(val||'')) && parseBRL(val||'')>=0),
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

export type FormData = yup.InferType<typeof schema>;

export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [loadingPage, setLoadingPage] = useState(true);
  const { control, handleSubmit, formState:{ errors, isValid, isSubmitting }, reset, trigger } = useForm<FormData>({
    mode:'onBlur',
    reValidateMode:'onChange',
    resolver: yupResolver(schema) as any,
    defaultValues:{
      name:'',
      priceStr:'',
      billingInterval:'month',
      billingIntervalCount:'1',
      paymentMethods:['credit_card'],
      billingCycles:'',
      active: true,
    }
  });

  useEffect(()=>{
    (async()=>{
      try {
        setLoadingPage(true);
        const snap = await getDoc(doc(db,'plans', id));
        if (!snap.exists()) {
          toast({ title: 'Plano não encontrado', status: 'error' });
          router.push('/admin/plans');
          return;
        }
        const data = snap.data() as any;
        reset({
          name: data?.name || '',
          priceStr: formatNumberPT(data?.price || 0),
          billingInterval: data?.billingInterval || 'month',
          billingIntervalCount: String(data?.billingIntervalCount ?? 1),
          paymentMethods: Array.isArray(data?.paymentMethods) && data.paymentMethods.length ? data.paymentMethods : ['credit_card'],
          billingCycles: (typeof data?.billingCycles === 'number' && Number.isFinite(data.billingCycles)) ? String(data.billingCycles) : '',
          active: data?.active ?? true,
        });
        await trigger();
      } finally {
        setLoadingPage(false);
      }
    })();
  }, [id, reset, trigger, router, toast]);

  const save = handleSubmit(async (data)=>{
    const price = parseBRL(data.priceStr);
    const billingIntervalCount = Number(data.billingIntervalCount);
    const billingCycles = data.billingCycles ? Number(data.billingCycles) : undefined;

    const payload: Record<string, any> = {
      name: data.name,
      price,
      active: !!data.active,
      billingInterval: data.billingInterval,
      billingIntervalCount,
      paymentMethods: data.paymentMethods,
      planSyncStatus: 'pending',
      planSyncError: deleteField(),
      updatedAt: serverTimestamp(),
    };
    if (billingCycles) {
      payload.billingCycles = billingCycles;
    } else {
      payload.billingCycles = deleteField();
    }

    await updateDoc(doc(db,'plans', id), payload);
    toast({ title:'Plano atualizado', status:'success' });
    router.push('/admin/plans');
  });

  return (
    <>
      {loadingPage && (
        <Flex position="fixed" inset={0} zIndex={1000} align="center" justify="center" bg="rgba(0,0,0,0.28)">
          <HStack bg="white" px={4} py={2} borderRadius="md" boxShadow="lg">
            <Spinner size="sm" />
            <Text fontWeight={600}>Carregando...</Text>
          </HStack>
        </Flex>
      )}
      <PageCard>
        <VStack align="stretch" spacing={6}>
          <HStack>
            <Icon name='folder' />
            <Text fontSize="xl" fontWeight={700}>Edição de plano</Text>
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
              <Controller name="active" control={control} render={({ field }) => (
                <FormControl isRequired maxW="140px">
                  <FormLabel>Status</FormLabel>
                  <Checkbox isChecked={!!field.value} onChange={(e)=>field.onChange(e.target.checked)}>Ativo</Checkbox>
                </FormControl>
              )}/>
            </HStack>
            <HStack spacing={4} align="flex-start" mt={4}>
              <Controller name="billingInterval" control={control} render={({ field, fieldState }) => (
                <FormControl isInvalid={!!fieldState.error} isRequired flex="1" maxW="220px">
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
                <FormControl isInvalid={!!fieldState.error} isRequired flex="1" maxW="220px">
                  <FormLabel>Repetir a cada</FormLabel>
                  <Input type="number" min={1} max={12} {...field} />
                  <FormHelperText>P. ex.: 1 = a cada mês.</FormHelperText>
                  <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                </FormControl>
              )}/>
              <Controller name="billingCycles" control={control} render={({ field, fieldState }) => (
                <FormControl isInvalid={!!fieldState.error} flex="1" maxW="220px">
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
                      <Checkbox key={opt.value} value={opt.value} isDisabled={opt.value === 'boleto'}>{opt.label}</Checkbox>
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
    </>
  );
}
