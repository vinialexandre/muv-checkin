import { Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel, Box, Checkbox, FormControl, FormLabel, HStack, Input, Select, Text, Textarea, VStack } from '@chakra-ui/react';
import { Controller, Control, UseFormWatch } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import { Icon } from '@/components/Icon';
import PageCard from '@/components/PageCard';
import { StudentFormData } from '@/app/admin/students/formConfig';

interface Props {
  control: Control<StudentFormData>;
  watch: UseFormWatch<StudentFormData>;
}

export default function TechnicalSheetTab({ control, watch }: Props) {
  const jiuBeltValue = watch('jiuJitsuBelt');

  return (
    <PageCard>
      <VStack align="stretch" spacing={4}>
        <VStack align="stretch" spacing={3}>
          <HStack>
            <Icon name='settings' />
            <Text fontSize="lg" fontWeight={700}>Ficha técnica</Text>
          </HStack>
        </VStack>
        <HStack spacing={3} wrap="wrap">
          <Controller name="weightKg" control={control} render={({ field }) => (
            <FormControl>
              <FormLabel>Peso (kg)</FormLabel>
              <Input as={IMaskInput as any} mask={Number} radix="," mapToRadix={["."]} thousandsSeparator="." scale={2} normalizeZeros padFractionalZeros placeholder="Peso (kg)" maxW="200px" value={field.value as any} onAccept={(val: any) => field.onChange(val)} />
            </FormControl>
          )}/>
          <Controller name="heightCm" control={control} render={({ field }) => (
            <FormControl>
              <FormLabel>Altura (cm)</FormLabel>
              <Input as={IMaskInput as any} mask={Number} radix="," mapToRadix={["."]} thousandsSeparator="." scale={2} normalizeZeros padFractionalZeros placeholder="Altura (cm)" maxW="200px" value={field.value as any} onAccept={(val: any) => field.onChange(val)} />
            </FormControl>
          )}/>
        </HStack>
        <VStack align="stretch" spacing={3}>
          <Text fontWeight={600}>Atividades praticadas</Text>
          <HStack spacing={4} wrap="wrap">
            {['funcional', 'boxe', 'mma', 'jiuJitsu'].map((activity) => (
              <Controller key={activity} name={`activities.${activity}` as any} control={control} render={({ field }) => (
                <Checkbox isChecked={field.value} onChange={(e) => field.onChange(e.target.checked)} sx={{ '.chakra-checkbox__control': { bg: field.value ? 'black' : 'white', borderColor: 'black', _checked: { bg: 'black', borderColor: 'black', color: 'white' } } }}>
                  {activity === 'funcional' ? 'Funcional' : activity === 'boxe' ? 'Boxe' : activity === 'mma' ? 'MMA' : 'Jiu Jitsu'}
                </Checkbox>
              )}/>
            ))}
          </HStack>
        </VStack>
        {watch('activities.jiuJitsu') && (
          <Accordion allowToggle maxW="900px">
            <AccordionItem borderTop="none">
              <AccordionButton px={0}>
                <Box flex="1" textAlign="left" fontWeight={600}>Especificações</Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel>
                <HStack spacing={4} align="stretch">
                  <Controller name="jiuJitsuBelt" control={control} render={({ field }) => (
                    <FormControl maxW="200px">
                      <FormLabel>Faixa de Jiu-Jitsu</FormLabel>
                      <Select placeholder="Selecione a faixa" {...field}>
                        {['branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta', 'vermelha'].map((belt) => (
                          <option key={belt} value={belt}>{belt.charAt(0).toUpperCase() + belt.slice(1)}</option>
                        ))}
                      </Select>
                    </FormControl>
                  )}/>
                  <Controller name="jiuJitsuDegree" control={control} render={({ field }) => (
                    <FormControl maxW="200px">
                      <FormLabel>Grau</FormLabel>
                      <Select placeholder="Selecione o grau" {...field}>
                        <option value="0">Sem grau</option>
                        {Array.from({ length: 10 }).map((_, idx) => {
                          const n = idx + 1;
                          const disabled = n >= 5 && !(jiuBeltValue === 'preta' || jiuBeltValue === 'vermelha');
                          return <option key={n} value={String(n)} disabled={disabled}>{`${n}° Grau`}</option>;
                        })}
                      </Select>
                    </FormControl>
                  )}/>
                </HStack>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        )}
        <Controller name="techNotes" control={control} render={({ field }) => (
          <FormControl>
            <FormLabel>Observações</FormLabel>
            <Textarea placeholder="Anote suas observações aqui" {...field} />
          </FormControl>
        )}/>
      </VStack>
    </PageCard>
  );
}
