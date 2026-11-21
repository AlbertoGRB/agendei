import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

const corte = {
  name: 'Corte de cabelo',
  durationMinutes: 60,
  priceCents: 5000,
};

describe('Serviços do prestador (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ana: string;
  let bruno: string;
  let carla: string;

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

  const create = (token: string, body: object) =>
    request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const list = (token: string) =>
    request(app.getHttpServer())
      .get('/services')
      .set('Authorization', `Bearer ${token}`);
  const update = (token: string, id: string, body: object) =>
    request(app.getHttpServer())
      .patch(`/services/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('cria o serviço, ativo, e ele aparece na lista do prestador', async () => {
    const created = await create(ana, corte);

    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      id: expect.any(String),
      ...corte,
      active: true,
    });

    const response = await list(ana);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([created.body]);
  });

  it('tira os espaços das pontas do nome', async () => {
    const response = await create(ana, { ...corte, name: '  Barba  ' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Barba');
  });

  it.each([
    ['duração que não é múltipla de 30', { durationMinutes: 45 }],
    ['duração abaixo de 30', { durationMinutes: 0 }],
    ['duração acima de 480', { durationMinutes: 510 }],
    ['duração em texto', { durationMinutes: '60' }],
    ['preço negativo', { priceCents: -1 }],
    ['preço com fração de centavo', { priceCents: 10.5 }],
    ['preço acima do teto', { priceCents: 10_000_001 }],
    ['nome só com espaços', { name: '   ' }],
    ['campo que não existe', { color: 'azul' }],
  ])('recusa %s e não cria nada', async (_case, change) => {
    const response = await create(ana, { ...corte, ...change });

    expect(response.status).toBe(400);
    expect((await list(ana)).body).toEqual([]);
  });

  it('explica a regra da duração em português', async () => {
    const response = await create(ana, { ...corte, durationMinutes: 45 });

    expect(response.body.message).toContain(
      'A duração deve ser múltipla de 30 minutos, de 30 a 480',
    );
  });

  it('edita só os campos enviados', async () => {
    const { body: service } = await create(ana, corte);

    const response = await update(ana, service.id, { priceCents: 6000 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...service, priceCents: 6000 });
  });

  it('desativa e reativa o serviço, que continua na lista do prestador', async () => {
    const { body: service } = await create(ana, corte);

    const off = await update(ana, service.id, { active: false });
    expect(off.status).toBe(200);
    expect(off.body.active).toBe(false);
    expect((await list(ana)).body).toEqual([{ ...service, active: false }]);

    const on = await update(ana, service.id, { active: true });
    expect(on.body.active).toBe(true);
  });

  it('recusa edição com dado inválido e não muda nada', async () => {
    const { body: service } = await create(ana, corte);

    const response = await update(ana, service.id, { durationMinutes: 50 });

    expect(response.status).toBe(400);
    expect((await list(ana)).body).toEqual([service]);
  });

  it('cada prestador vê só os próprios serviços', async () => {
    await create(ana, corte);

    expect((await list(bruno)).body).toEqual([]);
  });

  it('serviço de outro prestador responde 404 e não muda', async () => {
    const { body: service } = await create(ana, corte);

    const response = await update(bruno, service.id, { active: false });

    expect(response.status).toBe(404);
    expect((await list(ana)).body).toEqual([service]);
  });

  it('serviço que não existe responde 404', async () => {
    const response = await update(ana, 'nao-existe', { active: false });

    expect(response.status).toBe(404);
  });

  it('cliente não acessa as rotas de serviços', async () => {
    expect((await create(carla, corte)).status).toBe(403);
    expect((await list(carla)).status).toBe(403);
  });

  it('sem login, responde 401', async () => {
    const response = await request(app.getHttpServer()).get('/services');

    expect(response.status).toBe(401);
  });

  it('o banco recusa preço negativo e duração fora da regra, mesmo sem a API', async () => {
    const provider = await prisma.user.findUniqueOrThrow({
      where: { email: 'ana@exemplo.com' },
    });
    const insert = (data: { durationMinutes: number; priceCents: number }) =>
      prisma.service.create({
        data: { providerId: provider.id, name: 'Direto no banco', ...data },
      });

    await expect(
      insert({ durationMinutes: 60, priceCents: -1 }),
    ).rejects.toThrow(/Service_priceCents_check/);
    await expect(
      insert({ durationMinutes: 45, priceCents: 0 }),
    ).rejects.toThrow(/Service_durationMinutes_check/);
  });
});
