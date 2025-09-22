"use client";
import { Flex, Box, Spinner, HStack, Text } from '@chakra-ui/react';

export default function Loading() {
  return (
    <Flex position="fixed" inset={0} zIndex={1000} align="center" justify="center" bg="rgba(0,0,0,0.28)">
      <Box bg="white" px={4} py={2} borderRadius="md" boxShadow="lg">
        <HStack spacing={3}>
          <Spinner size="sm" />
          <Text fontWeight={600}>Carregando...</Text>
        </HStack>
      </Box>
    </Flex>
  );
}

