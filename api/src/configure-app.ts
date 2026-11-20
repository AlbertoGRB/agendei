import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Configuração comum à API no ar e aos testes e2e, para os testes
// rodarem a mesma aplicação que sobe no main.ts.
export function configureApp(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('agendei')
    .setDescription('API de agendamento de serviços sem horário duplicado')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Tela em /docs e o JSON da especificação em /docs-json.
  SwaggerModule.setup('docs', app, document);
}
