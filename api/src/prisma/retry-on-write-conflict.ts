import { Prisma } from '../generated/prisma/client.js';

// Quando duas transações travam uma esperando a outra (deadlock) ou entram
// em conflito de escrita, o PostgreSQL desfaz uma delas. O Prisma avisa com o
// código P2034, e a operação pode ser repetida.
export function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

// Roda a operação e repete quando o banco a desfez por conflito, até
// `attempts` vezes. Outros erros passam direto.
export async function retryOnWriteConflict<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isWriteConflict(error) || attempt >= attempts) {
        throw error;
      }
    }
  }
}
