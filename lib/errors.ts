export function ptAuthMessage(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
      return 'Credenciais inválidas. Verifique email e senha.';
    case 'auth/user-not-found':
      return 'Usuário não encontrado.';
    case 'auth/invalid-email':
      return 'Email inválido.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente mais tarde.';
    case 'auth/network-request-failed':
      return 'Falha de rede. Verifique sua conexão.';
    case 'auth/user-disabled':
      return 'Usuário desabilitado. Procure o administrador.';
    default:
      return 'Erro ao autenticar. Tente novamente.';
  }
}

export function ptGenericMessage(error: any, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  const code = error?.code || error?.name;
  if (typeof code === 'string' && code.startsWith('auth/')) return ptAuthMessage(code);
  if (code === 'permission-denied') return 'Permissão insuficiente para executar esta ação.';
  if (code === 'unavailable') return 'Serviço temporariamente indisponível. Tente novamente em instantes.';
  if (code === 'deadline-exceeded') return 'Tempo de resposta excedido. Tente novamente.';
  if (code === 'not-found') return 'Recurso não encontrado.';
  return fallback;
}

