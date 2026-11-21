import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { AsyncMicroserviceOptions } from '@nestjs/microservices';
import { workerOptions } from './notifications/queue.js';
import { WorkerModule } from './worker.module.js';

// Sobe o worker: consome a fila de notificações e manda os e-mails.
async function bootstrap() {
  const worker = await NestFactory.createMicroservice<AsyncMicroserviceOptions>(
    WorkerModule,
    {
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        workerOptions(config.getOrThrow<string>('RABBITMQ_URL')),
    },
  );
  // No SIGTERM (deploy, Ctrl+C), fecha a conexão com a fila e com o banco.
  worker.enableShutdownHooks();
  await worker.listen();
}
await bootstrap();
