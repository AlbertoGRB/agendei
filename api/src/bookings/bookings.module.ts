import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { UsersModule } from '../users/users.module.js';
import { AgendaController } from './agenda.controller.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { SlotsController } from './slots.controller.js';

@Module({
  imports: [
    UsersModule,
    CatalogModule,
    AvailabilityModule,
    NotificationsModule,
  ],
  controllers: [SlotsController, BookingsController, AgendaController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
