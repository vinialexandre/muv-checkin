"use client";
import PageCard from '@/components/PageCard';
import { Box, Button, Checkbox, Flex, FormControl, FormErrorMessage, FormLabel, HStack, Input, InputGroup, InputLeftAddon, Select, Spinner, Text, VStack, useToast } from '@chakra-ui/react';
import { useParams, useRouter } from 'next/navigation';
import * as yup from 'yup';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { IMaskInput } from 'react-imask';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

function parseBRL(v: string): number {
  if (!v) return NaN;
  const n = v.replace(/[^0-9,.-]/g, '').replace(/\./g,'').replace(',', '.');
  return parseFloat(n);
}
function formatNumberPT(n: number): string { return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); }

const schema = yup.object({
  name: yup.string().trim().min(2,'Nome muito curto').required('Nome obrigatório'),
  priceStr: yup.string().required('Valor obrigatório').test('valid','Valor inválido', (val)=> !isNaN(parseBRL(val||'')) && parseBRL(val||'')>=0),
  period: yup.mixed<'monthly'|'quarterly'|'semiannual'|'annual'>().oneOf(['monthly','quarterly','semiannual','annual']).required('Período obrigatório'),
  active: yup.boolean().required(),
});
type FormData = yup.InferType<typeof schema>;

export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { control, handleSubmit, formState:{ errors, isValid, isSubmitting }, reset, trigger } = useForm<FormData>({ mode:'onBlur', reValidateMode:'onBlur', resolver: yupResolver(schema), defaultValues:{ name:'', priceStr:'', period:'monthly', active: true } });
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(()=>{
    (async()=>{
      try {
        setLoadingPage(true);
        const snap = await getDoc(doc(db,'plans', id));
        const data = snap.data() as any;
        reset({ name: data?.name||'', priceStr: formatNumberPT(data?.price||0), period: (data?.period||'monthly'), active: data?.active ?? true });
        await trigger();
      } finally {
        setLoadingPage(false);
      }
    })();
  }, [id, reset]);

  const save = handleSubmit(async (data)=>{
    const price = parseBRL(data.priceStr);
    await updateDoc(doc(db,'plans', id), { name: data.name, price, period: data.period, active: !!(data as any).active });
    toast({ title:'Plano atualizado', status:'success' });
    router.push('/admin/plans');
  });

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
        <VStack align="stretch" spacing={4}>
          <Text fontSize="lg" fontWeight={600}>Edição de plano</Text>
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
            <FormControl isInvalid={!!(errors as any).period} isRequired>
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
    </>
  );
}
