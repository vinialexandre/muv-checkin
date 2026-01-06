import { Divider, FormControl, FormErrorMessage, FormLabel, HStack, Input, InputGroup, InputRightElement, SimpleGrid, Spinner, Text, VStack } from '@chakra-ui/react';
import { Controller, Control } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import { Icon } from '@/components/Icon';
import PageCard from '@/components/PageCard';
import { StudentFormData } from '@/app/admin/students/formConfig';

interface Props {
  control: Control<StudentFormData>;
  loadingCep: boolean;
}

export default function BillingTab({ control, loadingCep }: Props) {
  return (
    <PageCard>
      <VStack align="stretch" spacing={6}>
        <HStack>
          <Icon name='creditCard' />
          <Text fontSize="xl" fontWeight={700}>Dados de cobrança</Text>
        </HStack>
        <VStack align="stretch" spacing={4}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Controller name="billingName" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>Pagador</FormLabel>
                <Input placeholder="Nome completo do pagador" {...field} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
            <Controller name="billingEmail" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>E-mail do pagador</FormLabel>
                <Input type="email" placeholder="email@exemplo.com" {...field} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Controller name="billingDocument" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>CPF do pagador</FormLabel>
                <Input as={IMaskInput as any} mask="000.000.000-00" placeholder="000.000.000-00" value={field.value as any} onAccept={(val: any) => field.onChange(val)} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
            <Controller name="billingPhone" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>Telefone do pagador</FormLabel>
                <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="(00) 00000-0000" value={field.value as any} onAccept={(val: any) => field.onChange(val)} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
          </SimpleGrid>
          <Divider />
          <Controller name="billingZipCode" control={control} render={({ field, fieldState }) => (
            <FormControl isInvalid={!!fieldState.error} isRequired maxW="240px">
              <FormLabel>CEP</FormLabel>
              <InputGroup>
                <Input
                  as={IMaskInput as any}
                  mask="00000-000"
                  placeholder="00000-000"
                  value={field.value as any}
                  onAccept={(val: any) => field.onChange(val)}
                  pr="2.5rem"
                />
                {loadingCep && (
                  <InputRightElement pointerEvents="none">
                    <Spinner size="sm" />
                  </InputRightElement>
                )}
              </InputGroup>
              <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
            </FormControl>
          )} />
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Controller name="billingStreet" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>Rua</FormLabel>
                <Input placeholder="Rua" {...field} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
            <Controller name="billingNumber" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>Número</FormLabel>
                <Input placeholder="Número" {...field} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Controller name="billingDistrict" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>Bairro</FormLabel>
                <Input placeholder="Bairro" {...field} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
            <Controller name="billingCity" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>Cidade</FormLabel>
                <Input placeholder="Cidade" {...field} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
            <Controller name="billingState" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>UF</FormLabel>
                <Input placeholder="UF" maxW="120px" {...field} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Controller name="billingComplement" control={control} render={({ field }) => (
              <FormControl>
                <FormLabel>Complemento</FormLabel>
                <Input placeholder="Apartamento, bloco..." {...field} />
              </FormControl>
            )} />
            <Controller name="billingCountry" control={control} render={({ field, fieldState }) => (
              <FormControl isInvalid={!!fieldState.error} isRequired>
                <FormLabel>País</FormLabel>
                <Input placeholder="BR" maxW="160px" {...field} />
                <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
              </FormControl>
            )} />
          </SimpleGrid>
        </VStack>
      </VStack>
    </PageCard>
  );
}
