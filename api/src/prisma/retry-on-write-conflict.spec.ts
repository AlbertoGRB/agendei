import { Prisma } from '../generated/prisma/client.js';
import { retryOnWriteConflict } from './retry-on-write-conflict.js';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('erro do banco', {
    code,
    clientVersion: 'teste',
  });

describe('retryOnWriteConflict', () => {
  it('devolve o resultado quando dá certo de primeira', async () => {
    const operation = vi.fn().mockResolvedValue('ok');

    await expect(retryOnWriteConflict(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('repete quando o banco desfaz a operação por deadlock (P2034)', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(prismaError('P2034'))
      .mockResolvedValue('ok');

    await expect(retryOnWriteConflict(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('desiste depois de 3 tentativas e repassa o erro', async () => {
    const error = prismaError('P2034');
    const operation = vi.fn().mockRejectedValue(error);

    await expect(retryOnWriteConflict(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('não repete outros erros', async () => {
    const error = prismaError('P2002');
    const operation = vi.fn().mockRejectedValue(error);

    await expect(retryOnWriteConflict(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
