import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { REFRESH_COOKIE } from './auth/auth.controller.js';

// Configuração comum à API no ar e aos testes e2e, para os testes
// rodarem a mesma aplicação que sobe no main.ts.
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Em produção, o proxy do Railway fica na frente da API e troca o
  // X-Forwarded-For pelo IP que conectou nele. TRUST_PROXY diz quantos proxies
  // há na frente, para o Express ler esse IP em req.ip. Pela Vercel, esse IP é
  // o da Vercel, e o do cliente vem em outro cabeçalho (auth/client-ip.ts).
  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy) {
    const hops = Number(trustProxy);
    if (!Number.isInteger(hops) || hops < 1) {
      throw new Error(
        'TRUST_PROXY deve ser o número de proxies na frente da API, como 1',
      );
    }
    (app.getHttpAdapter().getInstance() as Express).set('trust proxy', hops);
  }

  // Cabeçalhos de segurança. Também tira o X-Powered-By.
  app.use(helmet());

  // Só o front do agendei chama a API pelo navegador. As credenciais
  // liberam o envio do cookie do token de renovação. Sem WEB_URL, a API
  // não sobe, em vez de bloquear o front sem avisar.
  app.enableCors({
    origin: config.getOrThrow<string>('WEB_URL'),
    credentials: true,
  });

  // Lê o cookie do token de renovação.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      // Recusa campos que o DTO não declara, em vez de só ignorar.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('agendei')
    .setDescription('API de agendamento de serviços sem horário duplicado')
    .setVersion('0.4.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Tela em /docs e o JSON da especificação em /docs-json.
  SwaggerModule.setup('docs', app, document);
}
