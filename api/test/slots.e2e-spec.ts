import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

// Uma segunda-feira no futuro, para nenhum horário ter passado.
const MONDAY = '2030-01-07';
const SUNDAY = '2030-01-06';

describe('Horários livres (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ana: string;
  let carla: string;
  let anaId: string;
  let carlaId: string;
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
    carla = await registerAndLogin(app, {
      name: 'Carla Dias',
      email: 'carla@exemplo.com',
      password: 'senha-forte-123',
      role: 'CLIENT',
    });
    anaId = (await authed(ana).get('/users/me')).body.id;
    carlaId = (await authed(carla).get('/users/me')).body.id;

    serviceId = (
      await authed(ana)
        .post('/services')
        .send({ name: 'Corte', durationMinutes: 60, priceCents: 5000 })
    ).body.id;
    // Segunda-feira, das 9h às 12h e das 14h às 18h, em Brasília.
    await authed(ana)
      .put('/availability')
      .send({
        windows: [
          { weekday: 1, startTime: '09:00', endTime: '12:00' },
          { weekday: 1, startTime: '14:00', endTime: '18:00' },
        ],
      });
  });

  afterAll(async () => {
    await app.close();
  });

  function authed(token: string) {
    const server = app.getHttpServer();
    return {
      get: (path: string) =>
        request(server).get(path).set('Authorization', `Bearer ${token}`),
      post: (path: string) =>
        request(server).post(path).set('Authorization', `Bearer ${token}`),
      put: (path: string) =>
        request(server).put(path).set('Authorization', `Bearer ${token}`),
    };
  }

  const slots = (query: Record<string, string>, providerId = anaId) =>
    authed(carla).get(`/providers/${providerId}/slots`).query(query);

  // Reserva gravada direto no banco: a rota de reserva vem na issue 14.
  const book = (startsAt: string, endsAt: string, status = 'CONFIRMED') =>
    prisma.booking.create({
      data: {
        serviceId,
        providerId: anaId,
        clientId: carlaId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        status: status as 'CONFIRMED' | 'CANCELLED',
      },
    });

  it('mostra os horários de 30 em 30 minutos em que o serviço cabe, em UTC', async () => {
    const response = await slots({ serviceId, date: MONDAY });

    expect(response.status).toBe(200);
    expect(response.body.date).toBe(MONDAY);
    expect(response.body.timezone).toBe('America/Sao_Paulo');
    // 09:00 a 11:00 e 14:00 a 17:00 em Brasília (UTC-3).
    expect(response.body.slots).toEqual([
      '2030-01-07T12:00:00.000Z',
      '2030-01-07T12:30:00.000Z',
      '2030-01-07T13:00:00.000Z',
      '2030-01-07T13:30:00.000Z',
      '2030-01-07T14:00:00.000Z',
      '2030-01-07T17:00:00.000Z',
      '2030-01-07T17:30:00.000Z',
      '2030-01-07T18:00:00.000Z',
      '2030-01-07T18:30:00.000Z',
      '2030-01-07T19:00:00.000Z',
      '2030-01-07T19:30:00.000Z',
      '2030-01-07T20:00:00.000Z',
    ]);
  });

  it('tira o horário reservado e os que se sobreporiam a ele', async () => {
    // 10h às 11h em Brasília.
    await book('2030-01-07T13:00:00Z', '2030-01-07T14:00:00Z');

    const { body } = await slots({ serviceId, date: MONDAY });

    expect(body.slots.slice(0, 2)).toEqual([
      '2030-01-07T12:00:00.000Z',
      '2030-01-07T14:00:00.000Z',
    ]);
  });

  it('reserva cancelada não ocupa o horário', async () => {
    await book('2030-01-07T13:00:00Z', '2030-01-07T14:00:00Z', 'CANCELLED');

    const { body } = await slots({ serviceId, date: MONDAY });

    expect(body.slots).toHaveLength(12);
  });

  it('dia sem atendimento devolve a lista vazia', async () => {
    const response = await slots({ serviceId, date: SUNDAY });

    expect(response.status).toBe(200);
    expect(response.body.slots).toEqual([]);
  });

  it('dia que já passou não tem horário', async () => {
    const { body } = await slots({ serviceId, date: '2020-01-06' });

    expect(body.slots).toEqual([]);
  });

  it('interpreta o dia e as janelas no fuso do prestador', async () => {
    const bruno = await registerAndLogin(app, {
      name: 'Bruno Lima',
      email: 'bruno@exemplo.com',
      password: 'senha-forte-123',
      role: 'PROVIDER',
      timezone: 'America/Manaus',
    });
    const brunoId = (await authed(bruno).get('/users/me')).body.id;
    const barba = (
      await authed(bruno)
        .post('/services')
        .send({ name: 'Barba', durationMinutes: 30, priceCents: 3000 })
    ).body.id;
    await authed(bruno)
      .put('/availability')
      .send({
        windows: [{ weekday: 1, startTime: '09:00', endTime: '10:00' }],
      });

    const { body } = await slots({ serviceId: barba, date: MONDAY }, brunoId);

    // Manaus fica em UTC-4: 9h lá são 13h em UTC.
    expect(body).toEqual({
      date: MONDAY,
      timezone: 'America/Manaus',
      slots: ['2030-01-07T13:00:00.000Z', '2030-01-07T13:30:00.000Z'],
    });
  });

  it('serviço desativado responde 404', async () => {
    await request(app.getHttpServer())
      .patch(`/services/${serviceId}`)
      .set('Authorization', `Bearer ${ana}`)
      .send({ active: false });

    expect((await slots({ serviceId, date: MONDAY })).status).toBe(404);
  });

  it('serviço de outro prestador e prestador que não existe respondem 404', async () => {
    const bruno = await registerAndLogin(app, {
      name: 'Bruno Lima',
      email: 'bruno@exemplo.com',
      password: 'senha-forte-123',
      role: 'PROVIDER',
    });
    const brunoId = (await authed(bruno).get('/users/me')).body.id;

    expect((await slots({ serviceId, date: MONDAY }, brunoId)).status).toBe(
      404,
    );
    expect(
      (await slots({ serviceId, date: MONDAY }, 'nao-existe')).status,
    ).toBe(404);
  });

  it.each([
    ['data fora do formato', { date: '2030-1-7' }],
    ['data que não existe', { date: '2030-02-30' }],
    ['sem a data', { date: undefined }],
    ['sem o serviço', { serviceId: undefined }],
  ])('recusa %s', async (_case, change) => {
    const query = Object.fromEntries(
      Object.entries({ serviceId, date: MONDAY, ...change }).filter(
        ([, value]) => value !== undefined,
      ),
    ) as Record<string, string>;

    expect((await slots(query)).status).toBe(400);
  });

  it('prestador não acessa a rota de horários livres', async () => {
    const response = await authed(ana)
      .get(`/providers/${anaId}/slots`)
      .query({ serviceId, date: MONDAY });

    expect(response.status).toBe(403);
  });
});
