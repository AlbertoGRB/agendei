import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { Prisma, type Booking } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { BookingDto } from './dto/booking.dto.js';
import type { SlotsDto } from './dto/slots.dto.js';
import {
  localDateOf,
  localDay,
  localToUtc,
  weekdayOf,
  type Interval,
} from './local-time.js';
import { freeSlots } from './slots.js';

// A constraint de exclusão barrou a reserva (código 23P01 do PostgreSQL).
function violatesNoOverlap(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { originalCode?: string } } | undefined;
  return adapterError?.cause?.originalCode === '23P01';
}

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
      windows: await this.windowsOn(providerId, date, timezone),
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

  // Reserva um horário (RF09). A garantia contra horário duplicado é o
  // próprio INSERT: a constraint de exclusão recusa a sobreposição (RN07).
  async create(
    clientId: string,
    serviceId: string,
    startsAt: Date,
  ): Promise<BookingDto> {
    const service = await this.catalog.findActive(undefined, serviceId);
    const provider =
      service && (await this.users.findProvider(service.providerId));
    if (!service || !provider) {
      throw new NotFoundException('Serviço não encontrado');
    }

    const now = new Date();
    if (startsAt <= now) {
      throw new BadRequestException('Esse horário já passou');
    }
    // O início precisa ser um horário da agenda do prestador: dentro de uma
    // janela, na grade de 30 minutos e com o serviço cabendo inteiro (RN04).
    // Aqui não se olha as outras reservas: isso fica com o banco.
    const date = localDateOf(startsAt, provider.timezone);
    const offered = freeSlots({
      windows: await this.windowsOn(provider.id, date, provider.timezone),
      bookings: [],
      durationMinutes: service.durationMinutes,
      now,
    });
    if (!offered.some((slot) => slot.getTime() === startsAt.getTime())) {
      throw new BadRequestException(
        'Esse horário não está na agenda do prestador',
      );
    }

    try {
      const booking = await this.prisma.booking.create({
        data: {
          serviceId,
          providerId: provider.id,
          clientId,
          startsAt,
          endsAt: new Date(
            startsAt.getTime() + service.durationMinutes * 60_000,
          ),
        },
      });
      const [dto] = await this.toDtos([booking]);
      return dto;
    } catch (error) {
      if (violatesNoOverlap(error)) {
        throw new ConflictException('Esse horário acabou de ser reservado');
      }
      throw error;
    }
  }

  // Janelas de atendimento de um dia, convertidas para instantes UTC.
  private async windowsOn(
    providerId: string,
    date: string,
    timezone: string,
  ): Promise<Interval[]> {
    const windows = await this.availability.forWeekday(
      providerId,
      weekdayOf(date),
    );
    return windows.map((window) => ({
      start: localToUtc(date, window.startTime, timezone),
      end: localToUtc(date, window.endTime, timezone),
    }));
  }

  // Monta a resposta com o nome do serviço e das pessoas. Busca pelos
  // services dos outros módulos, sem ler as tabelas deles direto.
  private async toDtos(bookings: Booking[]): Promise<BookingDto[]> {
    const services = await this.catalog.findByIds([
      ...new Set(bookings.map((b) => b.serviceId)),
    ]);
    const people = await this.users.findByIds([
      ...new Set(bookings.flatMap((b) => [b.providerId, b.clientId])),
    ]);
    const serviceById = new Map(services.map((s) => [s.id, s]));
    const nameById = new Map(people.map((p) => [p.id, p.name]));

    return bookings.map((booking) => {
      const service = serviceById.get(booking.serviceId);
      return {
        id: booking.id,
        status: booking.status,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        cancelledAt: booking.cancelledAt?.toISOString() ?? null,
        service: {
          id: booking.serviceId,
          name: service?.name ?? '',
          durationMinutes: service?.durationMinutes ?? 0,
          priceCents: service?.priceCents ?? 0,
        },
        provider: {
          id: booking.providerId,
          name: nameById.get(booking.providerId) ?? '',
        },
        client: {
          id: booking.clientId,
          name: nameById.get(booking.clientId) ?? '',
        },
      };
    });
  }
}
