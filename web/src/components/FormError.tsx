// Erro do formulário inteiro, vindo da API. O role="alert" faz o leitor de
// tela anunciar a mensagem assim que ela aparece.
export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {message}
    </p>
  );
}
