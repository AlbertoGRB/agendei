import { Injectable, NotFoundException } from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { SlotsDto } from './dto/slots.dto.js';
import { localDay, localToUtc, weekdayOf } from './local-time.js';
import { freeSlots } from './slots.js';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly catalog: CatalogService,
    private readonly availability: AvailabilityService,
  ) {}

  // Horários livres de um serviço num dia, no fuso do prestador (RF08).
  async slots(
    providerId: string,
    serviceId: string,
    date: string,
  ): Promise<SlotsDto> {
    const provider = await this.users.findProvider(providerId);
    if (!provider) {
      throw new NotFoundException('Prestador não encontrado');
    }
    // Serviço desativado ou de outro prestador não tem horário (RN10).
    const service = await this.catalog.findActive(providerId, serviceId);
    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    const { timezone } = provider;
    const windows = await this.availability.forWeekday(
      providerId,
      weekdayOf(date),
    );
    const day = localDay(date, timezone);
    // Só reserva confirmada ocupa o horário (RN06). Inclui a que começou no
    // dia anterior e ainda não terminou.
    const bookings = await this.prisma.booking.findMany({
      where: {
        providerId,
        status: 'CONFIRMED',
        startsAt: { lt: day.end },
        endsAt: { gt: day.start },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots = freeSlots({
      windows: windows.map((window) => ({
        start: localToUtc(date, window.startTime, timezone),
        end: localToUtc(date, window.endTime, timezone),
      })),
      bookings: bookings.map((booking) => ({
        start: booking.startsAt,
        end: booking.endsAt,
      })),
      durationMinutes: service.durationMinutes,
      now: new Date(),
    });

    return {
      date,
      timezone,
      slots: slots.map((slot) => slot.toISOString()),
    };
  }
}
