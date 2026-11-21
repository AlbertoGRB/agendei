import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  currentUser,
  login,
  logout,
  register,
  type NewAccount,
} from '../api/auth';

const SESSION_KEY = ['session'];

// A sessão mora no cache do TanStack Query: quem chamar este hook recebe o
// mesmo usuário, e a consulta à API acontece uma vez só.
export function useSession() {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: currentUser,
    staleTime: Infinity,
    retry: false,
  });

  return {
    user: session.data ?? null,
    loading: session.isPending,
    signIn: async (email: string, password: string) => {
      await login(email, password);
      queryClient.setQueryData(SESSION_KEY, await currentUser());
    },
    signUp: async (account: NewAccount) => {
      await register(account);
      queryClient.setQueryData(SESSION_KEY, await currentUser());
    },
    signOut: async () => {
      try {
        await logout();
      } catch {
        // Sem resposta da API, a sessão acaba só neste navegador: o cookie
        // continua valendo até vencer. Mesmo assim a pessoa sai da tela.
      } finally {
        endSession(queryClient);
      }
    },
  };
}

// Tira do cache tudo o que era da pessoa que saiu.
export function endSession(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== SESSION_KEY[0],
  });
  queryClient.setQueryData(SESSION_KEY, null);
}
