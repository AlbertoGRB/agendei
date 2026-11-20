import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

type TestAppOptions = {
  // Os testes chamam o cadastro e o login muitas vezes seguidas, então o
  // limite de requisições fica desligado, menos no teste do próprio limite.
  rateLimit?: boolean;
  // Controllers extras, só para o teste.
  controllers?: Type[];
};

// Sobe a API inteira, com a mesma configuração do main.ts.
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  });
  if (!options.rateLimit) {
    builder = builder
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true });
  }

  const app = (await builder.compile()).createNestApplication<
    INestApplication<App>
  >();
  configureApp(app);
  await app.init();
  return app;
}

// Apaga todos os dados do banco configurado no .env (ou no CI).
export async function resetDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  // O CASCADE limpa junto as tabelas que apontam para User.
  await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE`;
}

// Cadastra e entra, devolvendo o token de acesso.
export async function registerAndLogin(
  app: INestApplication<App>,
  user: { name: string; email: string; password: string; role: string },
): Promise<string> {
  await request(app.getHttpServer()).post('/auth/register').send(user);
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: user.email, password: user.password });
  return response.body.accessToken as string;
}
