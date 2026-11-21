import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';

// Erro 4xx é a resposta da API (não encontrado, sem permissão), e repetir não
// muda nada. Só a falha de rede ou do servidor é repetida, uma vez.
function shouldRetry(failureCount: number, error: Error): boolean {
  const answered =
    error instanceof ApiError && error.status >= 400 && error.status < 500;
  return !answered && failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: shouldRetry } },
  });
}
