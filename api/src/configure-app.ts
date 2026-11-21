import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { REFRESH_COOKIE } from './auth/auth.controller.js';

// Configuração comum à API no ar e aos testes e2e, para os testes
// rodarem a mesma aplicação que sobe no main.ts.
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

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
    .setVersion('0.3.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE)
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Tela em /docs e o JSON da especificação em /docs-json.
  SwaggerModule.setup('docs', app, document);
}
