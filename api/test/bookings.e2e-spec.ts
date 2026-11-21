import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

// Segunda-feira no futuro. Em Brasília (UTC-3), 9h = 12h UTC.
const MONDAY = '2030-01-07';
const AT_9 = '2030-01-07T12:00:00.000Z';
const AT_9_30 = '2030-01-07T12:30:00.000Z';
const AT_10 = '2030-01-07T13:00:00.000Z';

describe('Reserva (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ana: string;
  let carla: string;
  let davi: string;
  let anaId: string;
  let serviceId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ana = await registerAndLogin(app, {
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'senha-forte-123',
      role: 'PROVIDER',
    });
    // Carla mora em Manaus, mas a reserva vale no fuso da Ana, em Brasília.
    carla = await registerAndLogin(app, {
      name: 'Carla Dias',
      email: 'carla@exemplo.com',
      password: 'senha-forte-123',
      role: 'CLIENT',
      timezone: 'America/Manaus',
    });
    davi = await registerAndLogin(app, {
      name: 'Davi Rocha',
      email: 'davi@exemplo.com',
      password: 'senha-forte-123',
      role: 'CLIENT',
    });
    anaId = (await as(ana).get('/users/me')).body.id;
    serviceId = (
      await as(ana)
        .post('/services')
        .send({ name: 'Corte', durationMinutes: 60, priceCents: 5000 })
    ).body.id;
    // Segunda-feira, das 9h às 12h, em Brasília.
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
      patch: (path: string) => request(server).patch(path).set(auth),
    };
  }

  const book = (token: string, startsAt: string, service = serviceId) =>
    as(token).post('/bookings').send({ serviceId: service, startsAt });

  it('reserva um horário livre e devolve a reserva com os nomes', async () => {
    const response = await book(carla, AT_9);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      status: 'CONFIRMED',
      startsAt: AT_9,
      endsAt: AT_10,
      cancelledAt: null,
      timezone: 'America/Sao_Paulo',
      service: {
        id: serviceId,
        name: 'Corte',
        durationMinutes: 60,
        priceCents: 5000,
      },
      provider: { id: anaId, name: 'Ana Souza' },
      client: { id: expect.any(String), name: 'Carla Dias' },
    });
  });

  it('o horário reservado some dos horários livres', async () => {
    await book(carla, AT_9);

    const { body } = await as(davi)
      .get(`/providers/${anaId}/slots`)
      .query({ serviceId, date: MONDAY });

    expect(body.slots).not.toContain(AT_9);
    expect(body.slots).not.toContain(AT_9_30);
    expect(body.slots[0]).toBe(AT_10);
  });

  it('o mesmo horário para outro cliente responde 409 com a explicação', async () => {
    await book(carla, AT_9);

    const response = await book(davi, AT_9);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Esse horário acabou de ser reservado');
    expect(await prisma.booking.count()).toBe(1);
  });

  it('um horário que se sobrepõe a outra reserva também responde 409', async () => {
    await book(carla, AT_9);

    expect((await book(davi, AT_9_30)).status).toBe(409);
  });

  it('a reserva que começa quando a outra termina é aceita', async () => {
    await book(carla, AT_9);

    expect((await book(davi, AT_10)).status).toBe(201);
  });

  it('o mesmo horário com outro prestador é aceito', async () => {
    const bruno = await registerAndLogin(app, {
      name: 'Bruno Lima',
      email: 'bruno@exemplo.com',
      password: 'senha-forte-123',
      role: 'PROVIDER',
    });
    const barba = (
      await as(bruno)
        .post('/services')
        .send({ name: 'Barba', durationMinutes: 60, priceCents: 3000 })
    ).body.id;
    await as(bruno)
      .put('/availability')
      .send({
        windows: [{ weekday: 1, startTime: '09:00', endTime: '12:00' }],
      });
    await book(carla, AT_9);

    expect((await book(davi, AT_9, barba)).status).toBe(201);
  });

  it('o horário de uma reserva cancelada pode ser reservado de novo', async () => {
    const { body } = await book(carla, AT_9);
    await prisma.booking.update({
      where: { id: body.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    expect((await book(davi, AT_9)).status).toBe(201);
  });

  it('recusa horário que já passou', async () => {
    const response = await book(carla, '2020-01-06T12:00:00.000Z');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Esse horário já passou');
  });

  it.each([
    ['fora da janela', '2030-01-07T15:30:00.000Z'],
    ['fora da grade de 30 minutos', '2030-01-07T12:15:00.000Z'],
    [
      'em que o serviço não cabe até o fim da janela',
      '2030-01-07T14:30:00.000Z',
    ],
    ['num dia sem atendimento', '2030-01-06T12:00:00.000Z'],
  ])('recusa horário %s', async (_case, startsAt) => {
    const response = await book(carla, startsAt);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Esse horário não está na agenda do prestador',
    );
  });

  it('serviço desativado ou que não existe responde 404', async () => {
    await as(ana).patch(`/services/${serviceId}`).send({ active: false });

    expect((await book(carla, AT_9)).status).toBe(404);
    expect((await book(carla, AT_9, 'nao-existe')).status).toBe(404);
  });

  // O corpo é montado na hora do teste, quando o serviço já existe.
  it.each([
    ['sem o início', (id: string) => ({ serviceId: id })],
    [
      'início que não é data',
      (id: string) => ({ serviceId: id, startsAt: 'amanhã' }),
    ],
    ['sem o serviço', () => ({ startsAt: AT_9 })],
    [
      'campo que não existe',
      (id: string) => ({ serviceId: id, startsAt: AT_9, price: 0 }),
    ],
  ])('recusa corpo %s', async (_case, body) => {
    const response = await as(carla).post('/bookings').send(body(serviceId));

    expect(response.status).toBe(400);
  });

  it('prestador não reserva', async () => {
    expect((await book(ana, AT_9)).status).toBe(403);
  });

  it('o banco recusa a sobreposição mesmo sem passar pela API', async () => {
    const clientId = (await as(carla).get('/users/me')).body.id;
    const insert = (startsAt: string, endsAt: string) =>
      prisma.booking.create({
        data: {
          serviceId,
          providerId: anaId,
          clientId,
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
        },
      });
    await insert(AT_9, AT_10);

    await expect(insert(AT_9_30, '2030-01-07T13:30:00.000Z')).rejects.toThrow(
      /booking_no_overlap/,
    );
    await expect(insert(AT_10, AT_9)).rejects.toThrow(/Booking_time_check/);
  });
});
