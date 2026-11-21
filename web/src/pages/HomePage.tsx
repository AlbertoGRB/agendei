import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { messageOf } from '../api/client';
import { listProviders } from '../api/providers';
import { FormError } from '../components/FormError';
import { Loading } from '../components/Loading';
import { useSession } from '../hooks/useSession';
import { formatDuration, formatPrice } from '../lib/format';

export function HomePage() {
  const { user } = useSession();
  if (!user) {
    return null;
  }

  return (
    <section>
      <title>Início · agendei</title>
      <h1 className="text-2xl font-bold">Olá, {user.name.split(' ')[0]}</h1>
      {user.role === 'PROVIDER' ? (
        <p className="mt-2 text-slate-700">Você entrou como prestador.</p>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-semibold">Escolha um prestador</h2>
          <ProviderList />
        </>
      )}
    </section>
  );
}

// Prestadores com os serviços ativos de cada um (RF07).
function ProviderList() {
  const providers = useQuery({
    queryKey: ['providers'],
    queryFn: listProviders,
  });

  if (providers.isPending) {
    return <Loading />;
  }
  if (providers.isError) {
    return <FormError message={messageOf(providers.error)} />;
  }
  if (providers.data.length === 0) {
    return (
      <p className="mt-3 text-slate-700">
        Ainda não há prestadores com serviços.
      </p>
    );
  }
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {providers.data.map((provider) => (
        <li
          key={provider.id}
          className="flex flex-col rounded-lg border border-slate-200 bg-white p-4"
        >
          <h3 className="font-semibold">{provider.name}</h3>
          <ul className="mt-1 flex-1 text-sm text-slate-700">
            {provider.services.map((service) => (
              <li key={service.id}>
                {service.name} · {formatDuration(service.durationMinutes)} ·{' '}
                {formatPrice(service.priceCents)}
              </li>
            ))}
          </ul>
          <Link
            to={`/prestadores/${provider.id}`}
            className="mt-3 self-start rounded-md bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Ver horários <span className="sr-only">de {provider.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
