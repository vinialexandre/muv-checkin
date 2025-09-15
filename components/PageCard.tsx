"use client";
import { Box } from '@chakra-ui/react';

export default function PageCard({ children }: { children: React.ReactNode }) {
  return (
    <Box bg="white" borderRadius="md" borderWidth="1px" px={4} py={4} boxShadow="sm">
      {children}
    </Box>
  );
}

