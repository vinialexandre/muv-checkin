import { Badge, Box, Button, HStack, Image, SimpleGrid, Spinner, Text, VStack, useBreakpointValue } from '@chakra-ui/react';
import { Icon } from '@/components/Icon';
import PageCard from '@/components/PageCard';
import VideoCanvas from '@/components/VideoCanvas';
import LivenessHint from '@/components/LivenessHint';

interface Props {
  video: HTMLVideoElement | null;
  setVideo: (v: HTMLVideoElement | null) => void;
  faceReady: boolean;
  faceErr: string | null;
  livenessOk: boolean;
  samples: number[][];
  photoPreviews: string[];
  capturing: boolean;
  captureSample: () => void;
  openConfirm: (idx: number) => void;
}

export default function BiometryTab({ video, setVideo, faceReady, faceErr, livenessOk, samples, photoPreviews, capturing, captureSample, openConfirm }: Props) {
  const videoSize = useBreakpointValue({ base: 300, md: 500 });

  return (
    <PageCard>
      <VStack align="stretch" spacing={4}>
        <VStack align="stretch" spacing={3}>
          <HStack>
            <Icon name='camera' />
            <Text fontSize="lg" fontWeight={700}>Biometria facial</Text>
          </HStack>
          <VStack align="stretch" spacing={2}>
            <Badge colorScheme={faceReady ? 'green' : faceErr ? 'red' : 'gray'} alignSelf="flex-start">
              Modelos {faceReady ? 'OK' : faceErr ? 'Erro' : 'Carregando'}
            </Badge>
            <Badge colorScheme={samples.length >= 3 ? 'green' : 'red'} alignSelf="flex-start">
              {samples.length >= 3 ? `${samples.length} amostras` : 'Minimo de 3 amostras'}
            </Badge>
          </VStack>
        </VStack>
        <Text color="gray.600">Colete pelo menos 3 amostras com boa iluminacao e rosto centralizado.</Text>
        {!!faceErr && <Text color='red.500' fontSize='sm'>{faceErr}</Text>}
        <Box position="relative" width={{ base: '100%', md: '500px' }} height={{ base: '300px', md: '500px' }} display="inline-block" maxW="500px">
          <VideoCanvas size={videoSize || 300} onReady={setVideo} />
          {capturing && (
            <Box position="absolute" inset={0} display="flex" alignItems="center" justifyContent="center" bg="rgba(0,0,0,0.35)" zIndex={1}>
              <HStack spacing={3} bg="rgba(255,255,255,0.9)" px={4} py={2} borderRadius="md" boxShadow="md">
                <Spinner size="sm" />
                <Text color="gray.800" fontWeight={600}>Capturando...</Text>
              </HStack>
            </Box>
          )}
        </Box>
        <LivenessHint ok={livenessOk} />
        <VStack align="stretch" spacing={2}>
          <Button variant='secondary' onClick={captureSample} isDisabled={!video || !faceReady || capturing || samples.length >= 5} isLoading={capturing} loadingText="Capturando...">
            Capturar amostra
          </Button>
          <Text color="gray.700" textAlign="center">Amostras coletadas: {samples.length}/5</Text>
        </VStack>
        {photoPreviews.length > 0 && (
          <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
            {photoPreviews.map((src, index) => (
              <Box key={index} position="relative" boxSize="96px">
                <Image src={src} alt={`amostra ${index + 1}`} borderRadius="md" boxSize="96px" objectFit="cover" />
                <Button size="xs" onClick={() => openConfirm(index)} position="absolute" top={1} right={1} borderRadius="full" bg="white" _hover={{ bg: 'red.500', color: 'white' }}>
                  x
                </Button>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </VStack>
    </PageCard>
  );
}
