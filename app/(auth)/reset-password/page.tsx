"use client";
import { auth } from '@/lib/firebase';
import {
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box,
  List,
  ListItem,
  ListIcon
} from '@chakra-ui/react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { checkIcon, warningIcon } from '@/components/Icon';

function ResetPasswordInner() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [isValidCode, setIsValidCode] = useState(false);
  const [checkingCode, setCheckingCode] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Critérios de validação da senha
  const passwordCriteria = {
    minLength: password.length >= 6,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    match: password === confirmPassword && password.length > 0
  };

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  useEffect(() => {
    const mode = searchParams.get('mode');
    const code = searchParams.get('oobCode');

    if (mode !== 'resetPassword' || !code) {
      setCheckingCode(false);
      setIsValidCode(false);
      return;
    }

    setOobCode(code);

    // Verificar se o código é válido
    const verifyCode = async () => {
      try {
        const userEmail = await verifyPasswordResetCode(auth, code);
        setEmail(userEmail);
        setIsValidCode(true);
      } catch (error: any) {
        console.error('Código inválido:', error);
        setIsValidCode(false);

        if (error.code === 'auth/expired-action-code') {
          setError('O link de redefinição expirou. Solicite um novo link.');
        } else if (error.code === 'auth/invalid-action-code') {
          setError('Link inválido. Solicite um novo link de redefinição.');
        } else {
          setError('Erro ao verificar o link. Tente novamente.');
        }
      } finally {
        setCheckingCode(false);
      }
    };

    verifyCode();
  }, [searchParams]);

  const handleSubmit = async () => {
    setError(undefined);

    if (!isPasswordValid) {
      setError('Por favor, atenda a todos os critérios de senha.');
      return;
    }

    if (!oobCode) {
      setError('Código de redefinição não encontrado.');
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode, password);

      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Você pode fazer login com sua nova senha.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Redirecionar para login após sucesso
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (error: any) {
      console.error('Erro ao redefinir senha:', error);

      let errorMessage = 'Erro ao redefinir senha. Tente novamente.';

      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Link expirado. Solicite um novo link de redefinição.';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Link inválido. Solicite um novo link de redefinição.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Senha muito fraca. Use pelo menos 6 caracteres.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isPasswordValid && !loading) {
      handleSubmit();
    }
  };

  if (checkingCode) {
    return (
      <Stack align="center" mt={24}>
        <Card w="sm" variant="outline">
          <CardBody>
            <Stack align="center" spacing={4}>
              <Heading size="md">Verificando link...</Heading>
              <Text color="gray.600">Aguarde um momento</Text>
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    );
  }

  if (!isValidCode) {
    return (
      <Stack align="center" mt={24}>
        <Card w="sm" variant="outline">
          <CardBody>
            <Stack spacing={4}>
              <Heading size="md" color="red.500">Link Inválido</Heading>
              <Alert status="error">
                <AlertIcon />
                <Box>
                  <AlertTitle>Não foi possível redefinir a senha!</AlertTitle>
                  <AlertDescription>
                    {error || 'O link de redefinição é inválido ou expirou.'}
                  </AlertDescription>
                </Box>
              </Alert>
              <Button
                onClick={() => router.push('/login')}
                colorScheme="blue"
                w="full"
              >
                Voltar ao Login
              </Button>
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack align="center" mt={24}>
      <Card w="lg" variant="outline">
        <CardBody>
          <Stack spacing={4}>
            <Heading size="md">Redefinir Senha</Heading>
            <Text color="gray.600">
              Criando nova senha para: <strong>{email}</strong>
            </Text>

            <FormControl>
              <FormLabel>Nova Senha</FormLabel>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                type="password"
                placeholder="Digite sua nova senha"
                disabled={loading}
              />
            </FormControl>

            <FormControl>
              <FormLabel>Confirmar Nova Senha</FormLabel>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                type="password"
                placeholder="Confirme sua nova senha"
                disabled={loading}
              />
            </FormControl>

            {/* Critérios de validação */}
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Critérios da senha:
              </Text>
              <List spacing={1} fontSize="sm">
                <ListItem>
                  <ListIcon
                    as={passwordCriteria.minLength ? checkIcon : warningIcon}
                    color={passwordCriteria.minLength ? 'green.500' : 'red.500'}
                  />
                  Mínimo 6 caracteres
                </ListItem>
                <ListItem>
                  <ListIcon
                    as={passwordCriteria.hasUppercase ? checkIcon : warningIcon}
                    color={passwordCriteria.hasUppercase ? 'green.500' : 'red.500'}
                  />
                  Pelo menos uma letra maiúscula
                </ListItem>
                <ListItem>
                  <ListIcon
                    as={passwordCriteria.hasNumber ? checkIcon : warningIcon}
                    color={passwordCriteria.hasNumber ? 'green.500' : 'red.500'}
                  />
                  Pelo menos um número
                </ListItem>
                <ListItem>
                  <ListIcon
                    as={passwordCriteria.match ? checkIcon : warningIcon}
                    color={passwordCriteria.match ? 'green.500' : 'red.500'}
                  />
                  Senhas coincidem
                </ListItem>
              </List>
            </Box>

            {error && (
              <Alert status="error">
                <AlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSubmit}
              colorScheme="blue"
              w="full"
              isLoading={loading}
              loadingText="Redefinindo..."
              isDisabled={!isPasswordValid}
            >
              Redefinir Senha
            </Button>

            <Button
              variant="link"
              size="sm"
              onClick={() => router.push('/login')}
              isDisabled={loading}
            >
              Voltar ao Login
            </Button>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}


export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Stack align="center" mt={24}>
          <Card w="sm" variant="outline">
            <CardBody>
              <Stack align="center" spacing={4}>
                <Heading size="md">Carregando...</Heading>
                <Text color="gray.600">Aguarde um momento</Text>
              </Stack>
            </CardBody>
          </Card>
        </Stack>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
