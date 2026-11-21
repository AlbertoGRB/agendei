import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATIONS_CLIENT, rmqOptions } from './queue.js';

// Parte da API. O worker tem o próprio módulo (worker.module.ts).
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: NOTIFICATIONS_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          rmqOptions(config.getOrThrow<string>('RABBITMQ_URL')),
      },
    ]),
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
