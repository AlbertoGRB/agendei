import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { UsersModule } from '../users/users.module.js';
import { BookingsService } from './bookings.service.js';
import { SlotsController } from './slots.controller.js';

@Module({
  imports: [UsersModule, CatalogModule, AvailabilityModule],
  controllers: [SlotsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
