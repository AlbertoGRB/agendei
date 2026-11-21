import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  DEMO_CLIENT,
  DEMO_PASSWORD,
  DEMO_PROVIDER,
  seedDemo,
} from '../src/seed/seed-demo.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

// Quarta-feira, 9 de janeiro de 2030, ao meio-dia em Brasília.
const NOW = new Date('2030-01-09T15:00:00.000Z');

describe('Seed de demonstração (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const as = (token: string) => ({
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${token}`),
    post: (url: string) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${token}`),
    put: (url: string) =>
      request(app.getHttpServer())
        .put(url)
        .set('Authorization', `Bearer ${token}`),
  });

  const login = async (email: string) => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: DEMO_PASSWORD });
    expect(response.status).toBe(200);
    return response.body.accessToken as string;
  };

  it('a prestadora entra com a senha do README e encontra serviços e horários', async () => {
    expect(await seedDemo(prisma, NOW)).toEqual({
      services: 3,
      windows: 11,
      bookings: 5,
    });
    const ana = await login(DEMO_PROVIDER.email);

    expect((await as(ana).get('/users/me')).body).toMatchObject({
      name: 'Ana Souza',
      role: 'PROVIDER',
      timezone: 'America/Sao_Paulo',
    });
    const services = (await as(ana).get('/services')).body as {
      name: string;
      active: boolean;
    }[];
    expect(services.map((s) => [s.name, s.active])).toEqual([
      ['Barba', true],
      ['Corte', true],
      ['Corte e barba', true],
    ]);
    const { windows } = (await as(ana).get('/availability')).body as {
      windows: { weekday: number }[];
    };
    expect(windows).toHaveLength(11);
    expect(windows.some((w) => w.weekday === 0)).toBe(false);
  });

  it('as reservas ficam em volta do dia de hoje, no horário de Brasília', async () => {
    await seedDemo(prisma, NOW);
    const carla = await login(DEMO_CLIENT.email);
    const ana = await login(DEMO_PROVIDER.email);

    const bookings = (await as(carla).get('/bookings')).body as {
      startsAt: string;
      status: string;
      service: { name: string };
    }[];
    const summary = bookings
      .map((b) => [b.startsAt, b.service.name, b.status])
      .sort(([a], [b]) => a.localeCompare(b));
    expect(summary).toEqual([
      // Terça, o último dia útil, às 10h.
      ['2030-01-08T13:00:00.000Z', 'Corte', 'CONFIRMED'],
      // Quinta, às 10h e às 15h.
      ['2030-01-10T13:00:00.000Z', 'Corte', 'CONFIRMED'],
      ['2030-01-10T18:00:00.000Z', 'Barba', 'CONFIRMED'],
      // Sexta, às 9h (cancelada) e às 14h.
      ['2030-01-11T12:00:00.000Z', 'Barba', 'CANCELLED'],
      ['2030-01-11T17:00:00.000Z', 'Corte e barba', 'CONFIRMED'],
    ]);

    const agenda = await as(ana).get('/agenda').query({ date: '2030-01-10' });
    expect(
      agenda.body.bookings.map(
        (b: { client: { name: string } }) => b.client.name,
      ),
    ).toEqual(['Carla Dias', 'Carla Dias']);
  });

  it('numa sexta, as próximas reservas pulam o fim de semana', async () => {
    // Sexta-feira, 11 de janeiro de 2030, ao meio-dia em Brasília.
    await seedDemo(prisma, new Date('2030-01-11T15:00:00.000Z'));
    const carla = await login(DEMO_CLIENT.email);

    const days = (
      (await as(carla).get('/bookings')).body as {
        startsAt: string;
      }[]
    ).map((b) => b.startsAt.slice(0, 10));
    // Quinta, segunda e terça.
    expect([...new Set(days)].sort()).toEqual([
      '2030-01-10',
      '2030-01-14',
      '2030-01-15',
    ]);
  });

  it('rodar de novo volta ao estado inicial, sem duplicar e sem mexer nas outras contas', async () => {
    const bruno = await registerAndLogin(app, {
      name: 'Bruno Lima',
      email: 'bruno@exemplo.com',
      password: 'senha-forte-123',
      role: 'PROVIDER',
    });
    const davi = await registerAndLogin(app, {
      name: 'Davi Rocha',
      email: 'davi@exemplo.com',
      password: 'senha-forte-123',
      role: 'CLIENT',
    });
    const brunoService = (
      await as(bruno)
        .post('/services')
        .send({ name: 'Massagem', durationMinutes: 60, priceCents: 9000 })
    ).body.id as string;
    await as(bruno)
      .put('/availability')
      .send({
        windows: [{ weekday: 1, startTime: '09:00', endTime: '12:00' }],
      });
    // Segunda, 7 de janeiro de 2030, às 9h em Brasília.
    const withBruno = await as(davi)
      .post('/bookings')
      .send({ serviceId: brunoService, startsAt: '2030-01-07T12:00:00.000Z' });
    expect(withBruno.status).toBe(201);

    await seedDemo(prisma, NOW);
    const anaId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: DEMO_PROVIDER.email },
      })
    ).id;
    // Davi reserva com a Ana, que o seed vai refazer.
    const corte = (
      await prisma.service.findFirstOrThrow({
        where: { providerId: anaId, name: 'Corte' },
      })
    ).id;
    const withAna = await as(davi)
      .post('/bookings')
      .send({ serviceId: corte, startsAt: '2030-01-11T19:00:00.000Z' });
    expect(withAna.status).toBe(201);

    await seedDemo(prisma, NOW);

    expect(await prisma.user.count()).toBe(4);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { email: DEMO_PROVIDER.email },
        })
      ).id,
    ).toBe(anaId);
    expect(await prisma.service.count({ where: { providerId: anaId } })).toBe(
      3,
    );
    expect(
      await prisma.availability.count({ where: { providerId: anaId } }),
    ).toBe(11);
    expect(await prisma.booking.count({ where: { providerId: anaId } })).toBe(
      5,
    );
    // As contas de fora continuam como estavam, menos a reserva com a Ana.
    const daviBookings = (await as(davi).get('/bookings')).body as {
      id: string;
    }[];
    expect(daviBookings.map((b) => b.id)).toEqual([withBruno.body.id]);
    expect((await as(bruno).get('/services')).body).toHaveLength(1);
  });
});
