// O <output> é anunciado pelo leitor de tela quando muda, como role="status".
export function Loading() {
  return (
    <output className="block py-16 text-center text-slate-600">
      Carregando…
    </output>
  );
}
