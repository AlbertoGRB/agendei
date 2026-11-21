import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

// RNF02: várias reservas chegam ao mesmo tempo para o mesmo horário, e só
// uma é aceita. Quem decide é a constraint de exclusão do banco.

const CLIENTS = 10;
// Segunda-feira no futuro: 9h em Brasília = 12h UTC.
const AT_9 = '2030-01-07T12:00:00.000Z';

describe('Reservas simultâneas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let url: string;
  let serviceId: string;
  let clients: string[];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    // Uma porta de verdade, para as requisições chegarem juntas ao servidor.
    await app.listen(0);
    url = await app.getUrl();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const ana = await registerAndLogin(app, {
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'senha-forte-123',
      role: 'PROVIDER',
    });
    serviceId = (
      await request(url)
        .post('/services')
        .set('Authorization', `Bearer ${ana}`)
        .send({ name: 'Corte', durationMinutes: 60, priceCents: 5000 })
    ).body.id;
    await request(url)
      .put('/availability')
      .set('Authorization', `Bearer ${ana}`)
      .send({
        windows: [{ weekday: 1, startTime: '09:00', endTime: '12:00' }],
      });

    clients = [];
    for (let i = 0; i < CLIENTS; i++) {
      clients.push(
        await registerAndLogin(app, {
          name: `Cliente ${i}`,
          email: `cliente${i}@exemplo.com`,
          password: 'senha-forte-123',
          role: 'CLIENT',
        }),
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const book = (token: string, startsAt: string) =>
    request(url)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId, startsAt });

  it('10 reservas ao mesmo tempo para o mesmo horário: uma 201 e nove 409', async () => {
    const responses = await Promise.all(
      clients.map((token) => book(token, AT_9)),
    );

    const statuses = responses.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([201, ...Array<number>(CLIENTS - 1).fill(409)]);
    expect(
      responses.filter((r) => r.status === 409).map((r) => r.body.message),
    ).toEqual(
      Array<string>(CLIENTS - 1).fill('Esse horário acabou de ser reservado'),
    );
    expect(await prisma.booking.count({ where: { status: 'CONFIRMED' } })).toBe(
      1,
    );
  });

  it('inícios diferentes que se sobrepõem: nenhuma reserva aceita se sobrepõe a outra', async () => {
    // 9h, 9h30, 10h, 10h30 e 11h, com serviço de 1 hora, dois clientes em cada.
    const starts = [0, 30, 60, 90, 120].map((minutes) =>
      new Date(Date.parse(AT_9) + minutes * 60_000).toISOString(),
    );

    const responses = await Promise.all(
      clients.map((token, i) => book(token, starts[i % starts.length])),
    );

    expect(responses.every((r) => [201, 409].includes(r.status))).toBe(true);
    const confirmed = await prisma.booking.findMany({
      where: { status: 'CONFIRMED' },
      orderBy: { startsAt: 'asc' },
    });
    expect(confirmed.length).toBe(
      responses.filter((r) => r.status === 201).length,
    );
    // Em ordem de início, cada reserva começa depois de a anterior terminar.
    for (let i = 1; i < confirmed.length; i++) {
      expect(confirmed[i].startsAt.getTime()).toBeGreaterThanOrEqual(
        confirmed[i - 1].endsAt.getTime(),
      );
    }
    // Na janela de 3 horas cabem no máximo 3 reservas de 1 hora.
    expect(confirmed.length).toBeGreaterThanOrEqual(1);
    expect(confirmed.length).toBeLessThanOrEqual(3);
  });
});
