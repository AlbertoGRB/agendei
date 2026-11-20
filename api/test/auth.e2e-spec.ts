import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase } from './setup-app.js';

const ana = {
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  password: 'senha-forte-123',
  role: 'PROVIDER',
};

describe('Cadastro e login (e2e)', () => {
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

  const register = (body: object) =>
    request(app.getHttpServer()).post('/auth/register').send(body);
  const login = (body: object) =>
    request(app.getHttpServer()).post('/auth/login').send(body);

  describe('POST /auth/register', () => {
    it('cria a conta e não devolve a senha', async () => {
      const response = await register(ana);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(String),
        name: 'Ana Souza',
        email: 'ana@exemplo.com',
        role: 'PROVIDER',
        timezone: 'America/Sao_Paulo',
      });
    });

    it('grava só o hash bcrypt da senha', async () => {
      await register(ana);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: ana.email },
      });
      expect(user.passwordHash).not.toBe(ana.password);
      expect(user.passwordHash).toMatch(/^\$2b\$10\$/);
    });

    it('recusa e-mail já cadastrado, mesmo com letras maiúsculas', async () => {
      await register(ana);

      const response = await register({ ...ana, email: ' ANA@Exemplo.com ' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('E-mail já cadastrado');
      expect(await prisma.user.count()).toBe(1);
    });

    it.each([
      ['e-mail inválido', { email: 'ana' }],
      ['senha curta', { password: '1234567' }],
      ['papel que não existe', { role: 'ADMIN' }],
      ['fuso que não existe', { timezone: 'America/Nao_Existe' }],
      ['campo que o cadastro não aceita', { passwordHash: 'x' }],
    ])('recusa %s com 400', async (_caso, change) => {
      const response = await register({ ...ana, ...change });

      expect(response.status).toBe(400);
      expect(await prisma.user.count()).toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await register(ana);
    });

    it('entrega um token de acesso que abre as rotas protegidas', async () => {
      const response = await login({
        email: 'Ana@Exemplo.com',
        password: ana.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toEqual(expect.any(String));

      const me = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${response.body.accessToken}`);
      expect(me.status).toBe(200);
      expect(me.body.email).toBe('ana@exemplo.com');
    });

    it('o token de acesso vale por 15 minutos', async () => {
      const response = await login({
        email: ana.email,
        password: ana.password,
      });

      const payload = JSON.parse(
        Buffer.from(
          response.body.accessToken.split('.')[1],
          'base64url',
        ).toString(),
      );
      expect(payload.exp - payload.iat).toBe(15 * 60);
      expect(payload.role).toBe('PROVIDER');
    });

    it('recusa senha errada e e-mail desconhecido com a mesma mensagem', async () => {
      const wrongPassword = await login({
        email: ana.email,
        password: 'senha-errada',
      });
      const unknownEmail = await login({
        email: 'ninguem@exemplo.com',
        password: ana.password,
      });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.message).toBe('E-mail ou senha inválidos');
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });
  });

  describe('rotas protegidas', () => {
    it('recusam requisição sem token', async () => {
      const response = await request(app.getHttpServer()).get('/users/me');

      expect(response.status).toBe(401);
    });

    it('recusam token inválido', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer nao-e-um-jwt');

      expect(response.status).toBe(401);
    });
  });
});
