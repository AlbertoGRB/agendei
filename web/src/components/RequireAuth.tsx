import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../hooks/useSession';
import { Loading } from './Loading';

// Telas de quem entrou. Quem não entrou vai para a tela de entrar, que
// guarda para onde a pessoa ia.
export function RequireAuth() {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return <Loading />;
  }
  if (!user) {
    return (
      <Navigate to="/entrar" replace state={{ from: location.pathname }} />
    );
  }
  return <Outlet />;
}

// Telas de entrar e de cadastro. Assim que a sessão abre, leva a pessoa para
// onde ela ia, ou para o início.
export function GuestOnly() {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return <Loading />;
  }
  if (user) {
    return <Navigate to={returnPath(location.state)} replace />;
  }
  return <Outlet />;
}

// Só aceita caminho do próprio front, nunca um endereço de fora.
function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//')
    ? from
    : '/';
}
