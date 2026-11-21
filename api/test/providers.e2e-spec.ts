import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

describe('Prestadores e serviços ativos para o cliente (e2e)', () => {
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

  const createService = async (token: string, body: object) =>
    (
      await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
    ).body as { id: string };
  const deactivate = (token: string, id: string) =>
    request(app.getHttpServer())
      .patch(`/services/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });
  const get = (token: string, path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  it('lista os prestadores em ordem de nome, com os serviços ativos de cada um', async () => {
    const barba = await createService(bruno, {
      name: 'Barba',
      durationMinutes: 30,
      priceCents: 3000,
    });
    const corte = await createService(ana, {
      name: 'Corte',
      durationMinutes: 60,
      priceCents: 5000,
    });

    const response = await get(carla, '/providers');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: expect.any(String),
        name: 'Ana Souza',
        services: [
          {
            id: corte.id,
            name: 'Corte',
            durationMinutes: 60,
            priceCents: 5000,
          },
        ],
      },
      {
        id: expect.any(String),
        name: 'Bruno Lima',
        services: [
          {
            id: barba.id,
            name: 'Barba',
            durationMinutes: 30,
            priceCents: 3000,
          },
        ],
      },
    ]);
  });

  it('serviço desativado some da lista, e o prestador sem serviço ativo também', async () => {
    const corte = await createService(ana, {
      name: 'Corte',
      durationMinutes: 60,
      priceCents: 5000,
    });

    await deactivate(ana, corte.id);

    expect((await get(carla, '/providers')).body).toEqual([]);
  });

  it('não mostra o e-mail do prestador', async () => {
    await createService(ana, {
      name: 'Corte',
      durationMinutes: 60,
      priceCents: 5000,
    });

    const response = await get(carla, '/providers');

    expect(JSON.stringify(response.body)).not.toContain('@');
  });

  it('mostra um prestador com os serviços ativos', async () => {
    await createService(ana, {
      name: 'Corte',
      durationMinutes: 60,
      priceCents: 5000,
    });
    const barba = await createService(ana, {
      name: 'Barba',
      durationMinutes: 30,
      priceCents: 3000,
    });
    await deactivate(ana, barba.id);
    const [provider] = (await get(carla, '/providers')).body;

    const response = await get(carla, `/providers/${provider.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(provider);
    expect(response.body.services).toHaveLength(1);
  });

  it('prestador sem serviço ativo aparece com a lista vazia', async () => {
    const me = await get(ana, '/users/me');

    const response = await get(carla, `/providers/${me.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: me.body.id,
      name: 'Ana Souza',
      services: [],
    });
  });

  it('id de cliente ou que não existe responde 404', async () => {
    const me = await get(carla, '/users/me');

    expect((await get(carla, `/providers/${me.body.id}`)).status).toBe(404);
    expect((await get(carla, '/providers/nao-existe')).status).toBe(404);
  });

  it('prestador não acessa a lista de prestadores', async () => {
    expect((await get(ana, '/providers')).status).toBe(403);
  });
});
