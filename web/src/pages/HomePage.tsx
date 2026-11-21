import { useSession } from '../hooks/useSession';

export function HomePage() {
  const { user } = useSession();
  if (!user) {
    return null;
  }

  return (
    <section>
      <title>Início · agendei</title>
      <h1 className="text-2xl font-bold">Olá, {user.name.split(' ')[0]}</h1>
      <p className="mt-2 text-slate-700">
        {user.role === 'PROVIDER'
          ? 'Você entrou como prestador.'
          : 'Você entrou como cliente.'}
      </p>
    </section>
  );
}
