import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

// Segunda a sexta, das 9h às 12h e das 14h às 18h.
const weekdays = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, startTime: '09:00', endTime: '12:00' },
  { weekday, startTime: '14:00', endTime: '18:00' },
]);

describe('Disponibilidade do prestador (e2e)', () => {
  let app: INestApplication<App>;
  let ana: string;
  let bruno: string;
  let carla: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ana = await registerAndLogin(app, {
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      password: 'senha-forte-123',
      role: 'PROVIDER',
    });
    bruno = await registerAndLogin(app, {
      name: 'Bruno Lima',
      email: 'bruno@exemplo.com',
      password: 'senha-forte-123',
      role: 'PROVIDER',
    });
    carla = await registerAndLogin(app, {
      name: 'Carla Dias',
      email: 'carla@exemplo.com',
      password: 'senha-forte-123',
      role: 'CLIENT',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const save = (token: string, windows: unknown) =>
    request(app.getHttpServer())
      .put('/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ windows });
  const get = (token: string) =>
    request(app.getHttpServer())
      .get('/availability')
      .set('Authorization', `Bearer ${token}`);

  it('salva segunda a sexta, manhã e tarde, e devolve a semana em ordem', async () => {
    const shuffled = [...weekdays].reverse();

    const response = await save(ana, shuffled);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ windows: weekdays });
    expect((await get(ana)).body).toEqual({ windows: weekdays });
  });

  it('salvar de novo substitui a semana inteira', async () => {
    await save(ana, weekdays);
    const saturday = [{ weekday: 6, startTime: '08:00', endTime: '12:00' }];

    await save(ana, saturday);

    expect((await get(ana)).body).toEqual({ windows: saturday });
  });

  it('lista vazia tira toda a disponibilidade', async () => {
    await save(ana, weekdays);

    const response = await save(ana, []);

    expect(response.status).toBe(200);
    expect((await get(ana)).body).toEqual({ windows: [] });
  });

  it('aceita janelas que só se encostam', async () => {
    const response = await save(ana, [
      { weekday: 1, startTime: '09:00', endTime: '12:00' },
      { weekday: 1, startTime: '12:00', endTime: '14:00' },
    ]);

    expect(response.status).toBe(200);
  });

  it('recusa janelas sobrepostas no mesmo dia e mantém a semana anterior', async () => {
    await save(ana, weekdays);

    const response = await save(ana, [
      { weekday: 2, startTime: '09:00', endTime: '12:00' },
      { weekday: 2, startTime: '11:30', endTime: '13:00' },
    ]);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Em terça-feira, as janelas 09:00-12:00 e 11:30-13:00 se sobrepõem',
    );
    expect((await get(ana)).body).toEqual({ windows: weekdays });
  });

  it('aceita o mesmo horário em dias diferentes', async () => {
    const response = await save(ana, [
      { weekday: 1, startTime: '09:00', endTime: '12:00' },
      { weekday: 2, startTime: '09:00', endTime: '12:00' },
    ]);

    expect(response.status).toBe(200);
  });

  it.each([
    ['início igual ao fim', { startTime: '09:00', endTime: '09:00' }],
    ['início depois do fim', { startTime: '18:00', endTime: '09:00' }],
  ])('recusa %s', async (_case, change) => {
    const response = await save(ana, [{ weekday: 1, ...change }]);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/deve ser antes do fim/);
  });

  it.each([
    ['dia da semana 7', { weekday: 7 }],
    ['dia da semana negativo', { weekday: -1 }],
    ['hora sem o zero', { startTime: '9:00' }],
    ['minuto fora da meia hora', { startTime: '09:15' }],
    ['hora 24', { endTime: '24:00' }],
    ['campo que não existe', { note: 'almoço' }],
  ])('recusa %s', async (_case, change) => {
    const response = await save(ana, [
      { weekday: 1, startTime: '09:00', endTime: '12:00', ...change },
    ]);

    expect(response.status).toBe(400);
  });

  it('recusa corpo sem a lista de janelas', async () => {
    const response = await request(app.getHttpServer())
      .put('/availability')
      .set('Authorization', `Bearer ${ana}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it('cada prestador vê e muda só a própria disponibilidade', async () => {
    await save(ana, weekdays);

    await save(bruno, []);

    expect((await get(bruno)).body).toEqual({ windows: [] });
    expect((await get(ana)).body).toEqual({ windows: weekdays });
  });

  it('cliente não acessa a disponibilidade', async () => {
    expect((await save(carla, weekdays)).status).toBe(403);
    expect((await get(carla)).status).toBe(403);
  });
});
