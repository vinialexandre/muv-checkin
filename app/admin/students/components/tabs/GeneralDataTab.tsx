import { Checkbox, FormControl, FormErrorMessage, FormLabel, HStack, Input, InputGroup, InputRightElement, Button, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { Controller, Control } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import { Eye, EyeOff } from 'lucide-react';
import { Icon } from '@/components/Icon';
import PageCard from '@/components/PageCard';
import { StudentFormData } from '@/app/admin/students/formConfig';

interface Props {
  mode: 'new' | 'edit';
  control: Control<StudentFormData>;
  isMinorNow: boolean;
  showPwd: boolean;
  setShowPwd: (v: boolean) => void;
  showPwd2: boolean;
  setShowPwd2: (v: boolean) => void;
}

export default function GeneralDataTab({ mode, control, isMinorNow, showPwd, setShowPwd, showPwd2, setShowPwd2 }: Props) {
  return (
    <PageCard>
      <VStack align="stretch" spacing={6}>
        <HStack>
          <Icon name='users' />
          <Text fontSize="xl" fontWeight={700}>{mode === 'new' ? 'Cadastro' : 'Edição'} de aluno</Text>
        </HStack>
        <VStack align="stretch" spacing={4}>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} alignItems="start">
            <VStack align="stretch" spacing={4}>
              <HStack spacing={3} wrap="wrap">
                <Controller name="name" control={control} render={({ field, fieldState }) => (
                  <FormControl isInvalid={!!fieldState.error} isRequired>
                    <FormLabel>Nome</FormLabel>
                    <Input placeholder="Nome" {...field} />
                    <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                  </FormControl>
                )}/>
                <Controller name="birthDate" control={control} render={({ field, fieldState }) => (
                  <FormControl isInvalid={!!fieldState.error} isRequired>
                    <FormLabel>Data de nascimento</FormLabel>
                    <Input type="date" placeholder="Data de nascimento" {...field} />
                    <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                  </FormControl>
                )}/>
              </HStack>
              <HStack spacing={3} wrap="wrap">
                <Controller name="email" control={control} render={({ field, fieldState }) => (
                  <FormControl isInvalid={!!fieldState.error} isRequired={!isMinorNow}>
                    <FormLabel>E-mail</FormLabel>
                    <Input type="email" placeholder="E-mail" {...field} />
                    <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                  </FormControl>
                )}/>
                <Controller name="whatsapp" control={control} render={({ field, fieldState }) => (
                  <FormControl isInvalid={!!fieldState.error} isRequired={!isMinorNow}>
                    <FormLabel>WhatsApp</FormLabel>
                    <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="WhatsApp" value={field.value as any} onAccept={(val:any)=>field.onChange(val)} inputMode="tel" autoComplete="tel" type="tel" />
                    <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                  </FormControl>
                )}/>
              </HStack>
              <HStack spacing={3} wrap="wrap">
                <Controller name="password" control={control} render={({ field, fieldState }) => (
                  <FormControl isInvalid={!!fieldState.error}>
                    <FormLabel>Senha</FormLabel>
                    <InputGroup>
                      <Input type={showPwd ? 'text' : 'password'} placeholder="Senha" {...field} />
                      <InputRightElement>
                        <Button variant="ghost" size="sm" onClick={() => setShowPwd(!showPwd)}>
                          {showPwd ? <Eye size={16} /> : <EyeOff size={16} />}
                        </Button>
                      </InputRightElement>
                    </InputGroup>
                    <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                  </FormControl>
                )}/>
                <Controller name="confirmPassword" control={control} render={({ field, fieldState }) => (
                  <FormControl isInvalid={!!fieldState.error}>
                    <FormLabel>Confirmar senha</FormLabel>
                    <InputGroup>
                      <Input type={showPwd2 ? 'text' : 'password'} placeholder="Confirmar senha" {...field} />
                      <InputRightElement>
                        <Button variant="ghost" size="sm" onClick={() => setShowPwd2(!showPwd2)}>
                          {showPwd2 ? <Eye size={16} /> : <EyeOff size={16} />}
                        </Button>
                      </InputRightElement>
                    </InputGroup>
                    <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                  </FormControl>
                )}/>
              </HStack>
              <Controller name="active" control={control} render={({ field }) => (
                <Checkbox isChecked={!!field.value} onChange={(e) => field.onChange(e.target.checked)}>Ativo</Checkbox>
              )}/>
            </VStack>
            <VStack align="stretch" spacing={2}>
              <Text fontWeight={600} marginTop={5}>Dados do responsável</Text>
              <Text color="gray.600" fontSize="sm" marginBottom={1}>Obrigatório telefone e e-mail do responsável para menor de idade</Text>
              <HStack spacing={3} wrap="wrap">
                <Controller name="guardianName" control={control} render={({ field, fieldState }) => (
                  <FormControl isInvalid={!!fieldState.error} isRequired={isMinorNow} isDisabled={!isMinorNow}>
                    <FormLabel>Nome do responsável</FormLabel>
                    <Input placeholder="Nome do responsável" {...field} />
                    <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                  </FormControl>
                )}/>
                <Controller name="guardianEmail" control={control} render={({ field, fieldState }) => (
                  <FormControl marginTop={0.5} isInvalid={!!fieldState.error} isDisabled={!isMinorNow}>
                    <FormLabel>E-mail do responsável</FormLabel>
                    <Input type="email" placeholder="E-mail do responsável" {...field} />
                    <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                  </FormControl>
                )}/>
                <Controller name="guardianPhone" control={control} render={({ field, fieldState }) => (
                  <FormControl marginTop={0.5} isInvalid={!!fieldState.error} isRequired={isMinorNow} isDisabled={!isMinorNow}>
                    <FormLabel>WhatsApp do responsável</FormLabel>
                    <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="WhatsApp do responsável" value={field.value as any} onAccept={(val:any)=>field.onChange(val)} />
                    <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                  </FormControl>
                )}/>
              </HStack>
            </VStack>
          </SimpleGrid>
        </VStack>
      </VStack>
    </PageCard>
  );
}
