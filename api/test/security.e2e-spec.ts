import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Roles } from '../src/auth/roles.decorator.js';
import { createTestApp, registerAndLogin, resetDatabase } from './setup-app.js';

// Rotas que existem só neste teste, para conferir a guarda por papel.
@Controller('test-roles')
class RolesTestController {
  @Get('provider')
  @Roles('PROVIDER')
  providerOnly() {
    return { ok: true };
  }

  @Get('client')
  @Roles('CLIENT')
  clientOnly() {
    return { ok: true };
  }
}

const provider = {
  name: 'Paula Prestadora',
  email: 'paula@exemplo.com',
  password: 'senha-forte-123',
  role: 'PROVIDER',
};
const client = {
  name: 'Caio Cliente',
  email: 'caio@exemplo.com',
  password: 'senha-forte-123',
  role: 'CLIENT',
};

describe('Guardas por papel (e2e)', () => {
  let app: INestApplication<App>;
  let providerToken: string;
  let clientToken: string;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [RolesTestController] });
    await resetDatabase(app);
    providerToken = await registerAndLogin(app, provider);
    clientToken = await registerAndLogin(app, client);
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, token?: string) => {
    const call = request(app.getHttpServer()).get(path);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  it('cliente recebe 403 em rota de prestador', async () => {
    const response = await get('/test-roles/provider', clientToken);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Seu perfil não tem acesso a esta rota');
  });

  it('prestador recebe 403 em rota de cliente', async () => {
    expect((await get('/test-roles/client', providerToken)).status).toBe(403);
  });

  it('cada papel acessa a própria rota', async () => {
    expect((await get('/test-roles/provider', providerToken)).status).toBe(200);
    expect((await get('/test-roles/client', clientToken)).status).toBe(200);
  });

  it('sem login, a resposta é 401, não 403', async () => {
    expect((await get('/test-roles/provider')).status).toBe(401);
  });
});

describe('Limite de requisições (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({ rateLimit: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloqueia a 11ª tentativa de login no mesmo minuto', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alguem@exemplo.com', password: 'senha-errada' });

    for (let i = 0; i < 10; i++) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe(
      'Muitas tentativas. Espere um minuto e tente de novo.',
    );
  });

  it('o cadastro também tem limite', async () => {
    const attempt = () =>
      request(app.getHttpServer()).post('/auth/register').send({});

    for (let i = 0; i < 10; i++) {
      expect((await attempt()).status).toBe(400);
    }
    expect((await attempt()).status).toBe(429);
  });
});

describe('Cabeçalhos de segurança e CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde com os cabeçalhos do helmet e sem X-Powered-By', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('libera o front do agendei, com credenciais', async () => {
    const response = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  // A API sempre responde com o endereço do front. Para outro site, o
  // endereço não bate com o dele, e o navegador bloqueia a resposta.
  it('não libera outra origem', async () => {
    const response = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'https://site-qualquer.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });
});
