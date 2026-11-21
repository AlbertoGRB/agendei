import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // Lê o .env da pasta api/. Variável já definida no ambiente tem prioridade.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    AvailabilityModule,
    BookingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
