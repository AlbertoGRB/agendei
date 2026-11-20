import { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase } from './setup-app.js';

const ana = {
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  password: 'senha-forte-123',
  role: 'CLIENT',
};

// Lê o cookie refresh_token gravado pela resposta.
function refreshCookie(response: request.Response): string {
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('refresh_token='));
  if (!cookie) {
    throw new Error('A resposta não gravou o cookie refresh_token');
  }
  return cookie;
}

function cookieValue(cookie: string): string {
  return cookie.split(';')[0].slice('refresh_token='.length);
}

describe('Renovação da sessão e logout (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    await request(app.getHttpServer()).post('/auth/register').send(ana);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ana.email, password: ana.password });
    return refreshCookie(response);
  }

  const refresh = (cookie?: string) => {
    const call = request(app.getHttpServer()).post('/auth/refresh');
    return cookie ? call.set('Cookie', cookie.split(';')[0]) : call;
  };

  it('o login grava o cookie httpOnly, Secure e só para /auth', async () => {
    const cookie = await login();

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/auth');
  });

  it('o banco guarda só o hash do token de renovação', async () => {
    const value = cookieValue(await login());

    const stored = await prisma.refreshToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(value);
    expect(stored.tokenHash).toBe(
      createHash('sha256').update(value).digest('hex'),
    );
  });

  it('renova a sessão sem pedir a senha e troca o cookie', async () => {
    const oldCookie = await login();

    const response = await refresh(oldCookie);

    expect(response.status).toBe(200);
    const newCookie = refreshCookie(response);
    expect(cookieValue(newCookie)).not.toBe(cookieValue(oldCookie));

    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${response.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(ana.email);
  });

  it('recusa o token já usado e encerra as outras sessões do usuário', async () => {
    const oldCookie = await login();
    const newCookie = refreshCookie(await refresh(oldCookie));

    const reused = await refresh(oldCookie);
    expect(reused.status).toBe(401);

    // O token novo também deixa de valer, porque o antigo pode ter sido copiado.
    const afterReuse = await refresh(newCookie);
    expect(afterReuse.status).toBe(401);
  });

  it('duas renovações ao mesmo tempo com o mesmo token: só uma passa', async () => {
    const cookie = await login();

    const responses = await Promise.all([refresh(cookie), refresh(cookie)]);

    const statuses = responses.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 401]);
  });

  it('recusa token expirado', async () => {
    const cookie = await login();
    await prisma.refreshToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await refresh(cookie);

    expect(response.status).toBe(401);
  });

  it('recusa renovação sem cookie ou com cookie inventado', async () => {
    expect((await refresh()).status).toBe(401);
    expect((await refresh('refresh_token=inventado')).status).toBe(401);
  });

  it('depois do logout, o cookie antigo não renova mais', async () => {
    const cookie = await login();

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie.split(';')[0]);

    expect(logout.status).toBe(204);
    expect(refreshCookie(logout)).toContain('refresh_token=;');
    expect((await refresh(cookie)).status).toBe(401);
  });
});
