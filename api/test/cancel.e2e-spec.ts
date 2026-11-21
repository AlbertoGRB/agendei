import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

const MONDAY = '2030-01-07';
// 9h em Brasília.
const AT_9 = '2030-01-07T12:00:00.000Z';

describe('Minhas reservas e cancelamento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ana: string;
  let bruno: string;
  let carla: string;
  let davi: string;
  let anaId: string;
  let carlaId: string;
  let serviceId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const user = (name: string, email: string, role: string) =>
      registerAndLogin(app, { name, email, password: 'senha-forte-123', role });
    ana = await user('Ana Souza', 'ana@exemplo.com', 'PROVIDER');
    bruno = await user('Bruno Lima', 'bruno@exemplo.com', 'PROVIDER');
    carla = await user('Carla Dias', 'carla@exemplo.com', 'CLIENT');
    davi = await user('Davi Rocha', 'davi@exemplo.com', 'CLIENT');
    anaId = (await as(ana).get('/users/me')).body.id;
    carlaId = (await as(carla).get('/users/me')).body.id;
    serviceId = (
      await as(ana)
        .post('/services')
        .send({ name: 'Corte', durationMinutes: 60, priceCents: 5000 })
    ).body.id;
    await as(ana)
      .put('/availability')
      .send({
        windows: [{ weekday: 1, startTime: '09:00', endTime: '12:00' }],
      });
  });

  afterAll(async () => {
    await app.close();
  });

  function as(token: string) {
    const server = app.getHttpServer();
    const auth = { Authorization: `Bearer ${token}` };
    return {
      get: (path: string) => request(server).get(path).set(auth),
      post: (path: string) => request(server).post(path).set(auth),
      put: (path: string) => request(server).put(path).set(auth),
    };
  }

  const cancel = (token: string, id: string) =>
    as(token).post(`/bookings/${id}/cancel`);

  // Reserva gravada direto no banco, começando daqui a `minutes` minutos.
  // Serve para os casos que dependem da hora atual.
  const bookIn = async (minutes: number) => {
    const startsAt = new Date(Date.now() + minutes * 60_000);
    const booking = await prisma.booking.create({
      data: {
        serviceId,
        providerId: anaId,
        clientId: carlaId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      },
    });
    return booking.id;
  };

  describe('GET /bookings', () => {
    it('o cliente vê só as próprias reservas, com o status', async () => {
      await as(carla).post('/bookings').send({ serviceId, startsAt: AT_9 });
      await as(davi)
        .post('/bookings')
        .send({ serviceId, startsAt: '2030-01-07T13:00:00.000Z' });

      const response = await as(carla).get('/bookings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        status: 'CONFIRMED',
        startsAt: AT_9,
        client: { name: 'Carla Dias' },
        provider: { name: 'Ana Souza' },
      });
    });

    it('prestador não acessa "minhas reservas" de cliente', async () => {
      expect((await as(ana).get('/bookings')).status).toBe(403);
    });
  });

  describe('POST /bookings/:id/cancel', () => {
    it('o cliente cancela e o horário volta a ficar livre', async () => {
      const { body: booking } = await as(carla)
        .post('/bookings')
        .send({ serviceId, startsAt: AT_9 });

      const response = await cancel(carla, booking.id);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('CANCELLED');
      expect(response.body.cancelledAt).toEqual(expect.any(String));
      const { body } = await as(davi)
        .get(`/providers/${anaId}/slots`)
        .query({ serviceId, date: MONDAY });
      expect(body.slots).toContain(AT_9);
      expect(
        (await as(davi).post('/bookings').send({ serviceId, startsAt: AT_9 }))
          .status,
      ).toBe(201);
    });

    it('o cliente cancela com mais de 2 horas de antecedência', async () => {
      const id = await bookIn(180);

      expect((await cancel(carla, id)).status).toBe(200);
    });

    it('o cliente não cancela a menos de 2 horas do início, e a reserva continua', async () => {
      const id = await bookIn(60);

      const response = await cancel(carla, id);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        'O cliente só cancela até 2 horas antes do início',
      );
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
      expect(booking.status).toBe('CONFIRMED');
    });

    it('o prestador cancela a menos de 2 horas do início', async () => {
      const id = await bookIn(60);

      const response = await cancel(ana, id);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('CANCELLED');
    });

    it('o prestador não cancela a reserva que já começou', async () => {
      const id = await bookIn(-10);

      const response = await cancel(ana, id);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Essa reserva já começou');
    });

    it('cancelar de novo responde 409', async () => {
      const id = await bookIn(180);
      await cancel(carla, id);

      const response = await cancel(carla, id);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Essa reserva já foi cancelada');
    });

    it('dois cancelamentos ao mesmo tempo: só um muda a reserva', async () => {
      const id = await bookIn(180);

      const responses = await Promise.all([cancel(carla, id), cancel(ana, id)]);

      expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
    });

    it('a reserva de outro cliente responde 404 e não muda', async () => {
      const id = await bookIn(180);

      expect((await cancel(davi, id)).status).toBe(404);
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
      expect(booking.status).toBe('CONFIRMED');
    });

    it('a reserva da agenda de outro prestador responde 404', async () => {
      const id = await bookIn(180);

      expect((await cancel(bruno, id)).status).toBe(404);
    });

    it('reserva que não existe responde 404', async () => {
      expect((await cancel(carla, 'nao-existe')).status).toBe(404);
    });
  });
});
