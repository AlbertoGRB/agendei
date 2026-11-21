import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

const MONDAY = '2030-01-07';
const TUESDAY = '2030-01-08';
// 9h e 10h em Brasília.
const AT_9 = '2030-01-07T12:00:00.000Z';
const AT_10 = '2030-01-07T13:00:00.000Z';

describe('Agenda do dia do prestador (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ana: string;
  let bruno: string;
  let carla: string;
  let davi: string;
  let anaId: string;
  let carlaId: string;
  let serviceId: string;
  let brunoServiceId: string;

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

    const monday = {
      windows: [{ weekday: 1, startTime: '09:00', endTime: '12:00' }],
    };
    serviceId = (
      await as(ana)
        .post('/services')
        .send({ name: 'Corte', durationMinutes: 60, priceCents: 5000 })
    ).body.id;
    await as(ana).put('/availability').send(monday);
    brunoServiceId = (
      await as(bruno)
        .post('/services')
        .send({ name: 'Barba', durationMinutes: 30, priceCents: 3000 })
    ).body.id;
    await as(bruno).put('/availability').send(monday);
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

  const book = (token: string, startsAt: string, id = serviceId) =>
    as(token).post('/bookings').send({ serviceId: id, startsAt });

  const agenda = (token: string, date: string) =>
    as(token).get('/agenda').query({ date });

  it('mostra as reservas confirmadas do dia em ordem de horário', async () => {
    await book(davi, AT_10);
    await book(carla, AT_9);

    const response = await agenda(ana, MONDAY);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      date: MONDAY,
      timezone: 'America/Sao_Paulo',
    });
    expect(response.body.bookings).toHaveLength(2);
    expect(response.body.bookings[0]).toMatchObject({
      status: 'CONFIRMED',
      startsAt: AT_9,
      endsAt: AT_10,
      service: { name: 'Corte', durationMinutes: 60, priceCents: 5000 },
      client: { name: 'Carla Dias' },
      provider: { name: 'Ana Souza' },
    });
    expect(response.body.bookings[1]).toMatchObject({
      startsAt: AT_10,
      client: { name: 'Davi Rocha' },
    });
  });

  it('não mostra a reserva cancelada', async () => {
    const { body: booking } = await book(carla, AT_9);
    await as(carla).post(`/bookings/${booking.id}/cancel`);

    const response = await agenda(ana, MONDAY);

    expect(response.status).toBe(200);
    expect(response.body.bookings).toEqual([]);
  });

  it('não mostra reserva de outro dia nem da agenda de outro prestador', async () => {
    await book(carla, '2030-01-14T12:00:00.000Z');
    await book(carla, AT_9, brunoServiceId);

    const response = await agenda(ana, MONDAY);

    expect(response.body.bookings).toEqual([]);
    expect((await agenda(bruno, MONDAY)).body.bookings).toHaveLength(1);
  });

  it('conta o dia no fuso do prestador: 23h30 em Brasília é o mesmo dia', async () => {
    // 23h30 de segunda em Brasília já é terça em UTC. Gravada direto no banco
    // porque fica fora da janela de atendimento.
    await prisma.booking.create({
      data: {
        serviceId,
        providerId: anaId,
        clientId: carlaId,
        startsAt: new Date('2030-01-08T02:30:00.000Z'),
        endsAt: new Date('2030-01-08T03:30:00.000Z'),
      },
    });

    const monday = await agenda(ana, MONDAY);
    const tuesday = await agenda(ana, TUESDAY);

    expect(monday.body.bookings).toHaveLength(1);
    expect(monday.body.bookings[0].startsAt).toBe('2030-01-08T02:30:00.000Z');
    expect(tuesday.body.bookings).toEqual([]);
  });

  it.each(['07/01/2030', '2030-02-30', ''])(
    'data inválida (%s) responde 400',
    async (date) => {
      expect((await agenda(ana, date)).status).toBe(400);
    },
  );

  it('sem a data responde 400', async () => {
    expect((await as(ana).get('/agenda')).status).toBe(400);
  });

  it('cliente não acessa a agenda', async () => {
    expect((await agenda(carla, MONDAY)).status).toBe(403);
  });

  it('sem token responde 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/agenda')
      .query({ date: MONDAY });

    expect(response.status).toBe(401);
  });
});
