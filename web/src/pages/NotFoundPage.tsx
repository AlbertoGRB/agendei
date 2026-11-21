import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="py-8 text-center">
      <title>Página não encontrada · agendei</title>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-slate-700">
        O endereço pode estar errado, ou a página mudou de lugar.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block font-semibold text-teal-800 underline"
      >
        Voltar ao início
      </Link>
    </section>
  );
}
