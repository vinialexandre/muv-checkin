"use client";
import { Modal, ModalOverlay, ModalContent, Image, IconButton } from '@chakra-ui/react';
import { Icon } from './Icon';

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoSrc: string;
}

export default function PhotoModal({ isOpen, onClose, photoSrc }: PhotoModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered>
      <ModalOverlay bg="rgba(0, 0, 0, 0.8)" onClick={onClose} />
      <ModalContent bg="transparent" boxShadow="none" w="50vw" h="50vh" position="relative">
        <IconButton
          aria-label="Fechar"
          icon={<Icon name="x" size={50} />}
          position="fixed"
          top={8}
          right={8}
          zIndex={1000}
          bg="transparent"
          onClick={onClose}
        />
        <Image
          src={photoSrc}
          alt="Foto ampliada"
          w="100%"
          h="100%"
          objectFit="contain"
          cursor="pointer"
          onClick={onClose}
        />
      </ModalContent>
    </Modal>
  );
}