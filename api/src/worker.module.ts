import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeliveryService } from './notifications/delivery.service.js';
import { MailerService } from './notifications/mailer.service.js';
import { NotificationsController } from './notifications/notifications.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

// Só o que o worker usa: banco, fila e e-mail. Sem as rotas HTTP.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [NotificationsController],
  providers: [DeliveryService, MailerService],
})
export class WorkerModule {}
