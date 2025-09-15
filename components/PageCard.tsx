"use client";
import { Box } from '@chakra-ui/react';

export default function PageCard({ children }: { children: React.ReactNode }) {
  return (
    <Box bg="brand.primary" borderRadius="lg" borderWidth="1px" borderColor="gray.200" px={6} py={6} boxShadow="md">
      {children}
    </Box>
  );
}
