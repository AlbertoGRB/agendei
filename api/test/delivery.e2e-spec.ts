import { Test, TestingModule } from '@nestjs/testing';
import type { Email } from '../src/notifications/booking-email.js';
import { DeliveryService } from '../src/notifications/delivery.service.js';
import { MailerService } from '../src/notifications/mailer.service.js';
import type { BookingMessage } from '../src/notifications/queue.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { WorkerModule } from '../src/worker.module.js';
import { resetDatabase } from './setup-app.js';

// O worker sem a fila: o envio, o registro e as novas tentativas, com um
// servidor de e-mail falso.
describe('Envio de e-mail no worker (e2e)', () => {
  let worker: TestingModule;
  let prisma: PrismaService;
  let delivery: DeliveryService;
  let message: BookingMessage;
  const send = vi.fn<(email: Email) => Promise<void>>();

  beforeAll(async () => {
    worker = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(MailerService)
      .useValue({ send })
      .compile();
    prisma = worker.get(PrismaService);
    delivery = worker.get(DeliveryService);
    delivery.retryDelays = [0, 0];
  });

  beforeEach(async () => {
    await resetDatabase(worker);
    send.mockReset();
    send.mockResolvedValue(undefined);

    const user = (name: string, email: string, role: 'PROVIDER' | 'CLIENT') =>
      prisma.user.create({ data: { name, email, role, passwordHash: '-' } });
    const ana = await user('Ana Souza', 'ana@exemplo.com', 'PROVIDER');
    const carla = await user('Carla Dias', 'carla@exemplo.com', 'CLIENT');
    const service = await prisma.service.create({
      data: {
        providerId: ana.id,
        name: 'Corte',
        durationMinutes: 60,
        priceCents: 5000,
      },
    });
    const booking = await prisma.booking.create({
      data: {
        serviceId: service.id,
        providerId: ana.id,
        clientId: carla.id,
        startsAt: new Date('2030-01-07T12:00:00.000Z'),
        endsAt: new Date('2030-01-07T13:00:00.000Z'),
      },
    });
    message = {
      bookingId: booking.id,
      to: carla.email,
      clientName: carla.name,
      providerName: ana.name,
      serviceName: service.name,
      startsAt: booking.startsAt.toISOString(),
      timezone: ana.timezone,
    };
  });

  afterAll(async () => {
    await worker.close();
  });

  const records = () =>
    prisma.notification.findMany({
      where: { bookingId: message.bookingId },
      orderBy: { type: 'asc' },
    });

  it('envia o e-mail e registra o envio', async () => {
    await delivery.deliver(message, 'CONFIRMATION');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'carla@exemplo.com',
        subject: 'Reserva confirmada: Corte em 07/01/2030 às 09:00',
      }),
    );
    expect(await records()).toMatchObject([{ type: 'CONFIRMATION' }]);
  });

  it('confirmação e cancelamento da mesma reserva são envios separados', async () => {
    await delivery.deliver(message, 'CONFIRMATION');
    await delivery.deliver(
      { ...message, cancelledBy: 'CLIENT' },
      'CANCELLATION',
    );

    expect(send).toHaveBeenCalledTimes(2);
    expect((await records()).map((r) => r.type)).toEqual([
      'CONFIRMATION',
      'CANCELLATION',
    ]);
  });

  it('se o envio falha, tenta de novo e manda uma vez só', async () => {
    send.mockRejectedValueOnce(new Error('SMTP fora do ar'));

    await delivery.deliver(message, 'CONFIRMATION');

    expect(send).toHaveBeenCalledTimes(2);
    expect(await records()).toHaveLength(1);
  });

  it('desiste depois de 3 tentativas e não registra o envio', async () => {
    send.mockRejectedValue(new Error('SMTP fora do ar'));

    await delivery.deliver(message, 'CONFIRMATION');

    expect(send).toHaveBeenCalledTimes(3);
    expect(await records()).toHaveLength(0);
  });

  it('depois de uma falha, a mesma mensagem entregue de novo envia o e-mail', async () => {
    send.mockRejectedValue(new Error('SMTP fora do ar'));
    await delivery.deliver(message, 'CONFIRMATION');
    send.mockResolvedValue(undefined);

    await delivery.deliver(message, 'CONFIRMATION');

    expect(send).toHaveBeenCalledTimes(4);
    expect(await records()).toHaveLength(1);
  });

  // RN12: a fila pode entregar a mesma mensagem mais de uma vez.
  describe('a mesma mensagem duas vezes', () => {
    it('uma depois da outra: manda um e-mail só', async () => {
      await delivery.deliver(message, 'CONFIRMATION');
      await delivery.deliver(message, 'CONFIRMATION');

      expect(send).toHaveBeenCalledTimes(1);
      expect(await records()).toHaveLength(1);
    });

    it('ao mesmo tempo: manda um e-mail só', async () => {
      // O envio demora, então a segunda entrega chega enquanto a primeira
      // ainda está com a transação aberta.
      send.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 300)),
      );

      await Promise.all([
        delivery.deliver(message, 'CONFIRMATION'),
        delivery.deliver(message, 'CONFIRMATION'),
      ]);

      expect(send).toHaveBeenCalledTimes(1);
      expect(await records()).toHaveLength(1);
    });

    it('ao mesmo tempo, com o primeiro envio falhando: o segundo envia', async () => {
      // A primeira entrega falha nas 3 tentativas e desfaz o registro a cada
      // vez. A segunda, que esperava na chave única, consegue gravar e envia.
      send
        .mockImplementationOnce(
          () =>
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('SMTP fora do ar')), 300),
            ),
        )
        .mockResolvedValue(undefined);

      await Promise.all([
        delivery.deliver(message, 'CONFIRMATION'),
        delivery.deliver(message, 'CONFIRMATION'),
      ]);

      expect(await records()).toHaveLength(1);
      // Uma falha e um envio que deu certo; a outra entrega achou o registro.
      expect(send).toHaveBeenCalledTimes(2);
    });
  });
});
