import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { Prisma, type Booking, type Role } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  BOOKING_CANCELLED,
  BOOKING_CREATED,
  type BookingEvent,
} from '../notifications/queue.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { cancellationProblem } from './cancellation.js';
import type { AgendaDto } from './dto/agenda.dto.js';
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
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly catalog: CatalogService,
    private readonly availability: AvailabilityService,
    private readonly notifications: NotificationsService,
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

    let booking: Booking;
    try {
      booking = await this.prisma.booking.create({
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
    } catch (error) {
      if (violatesNoOverlap(error)) {
        throw new ConflictException('Esse horário acabou de ser reservado');
      }
      throw error;
    }

    await this.notify(BOOKING_CREATED, booking);
    const [dto] = await this.toDtos([booking]);
    return dto;
  }

  // Reservas confirmadas que começam no dia, no fuso do prestador (RF06).
  async agenda(providerId: string, date: string): Promise<AgendaDto> {
    const provider = await this.users.findProvider(providerId);
    if (!provider) {
      throw new NotFoundException('Prestador não encontrado');
    }
    const day = localDay(date, provider.timezone);
    const bookings = await this.prisma.booking.findMany({
      where: {
        providerId,
        status: 'CONFIRMED',
        startsAt: { gte: day.start, lt: day.end },
      },
      orderBy: { startsAt: 'asc' },
    });
    return {
      date,
      timezone: provider.timezone,
      bookings: await this.toDtos(bookings),
    };
  }

  // Reservas do cliente, da mais nova para a mais antiga (RF10).
  async listForClient(clientId: string): Promise<BookingDto[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { clientId },
      orderBy: { startsAt: 'desc' },
    });
    return this.toDtos(bookings);
  }

  // Cancela uma reserva do cliente ou da agenda do prestador (RF11, RF12).
  async cancel(user: AuthUser, id: string): Promise<BookingDto> {
    // Cada um só cancela o que é seu. A de outra pessoa responde 404 (RN09).
    const owner =
      user.role === 'CLIENT' ? { clientId: user.id } : { providerId: user.id };
    const booking = await this.prisma.booking.findFirst({
      where: { id, ...owner },
    });
    if (!booking) {
      throw new NotFoundException('Reserva não encontrada');
    }

    const now = new Date();
    const problem = cancellationProblem(booking, user.role, now);
    if (problem) {
      throw new ConflictException(problem);
    }
    // Só cancela se ainda estiver confirmada: dois cliques ao mesmo tempo
    // não cancelam duas vezes.
    const { count } = await this.prisma.booking.updateMany({
      where: { id, status: 'CONFIRMED' },
      data: { status: 'CANCELLED', cancelledAt: now },
    });
    if (count === 0) {
      throw new ConflictException('Essa reserva já foi cancelada');
    }

    const cancelled = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
    });
    await this.notify(BOOKING_CANCELLED, cancelled, user.role);
    const [dto] = await this.toDtos([cancelled]);
    return dto;
  }

  // Pede ao worker o e-mail para o cliente (RF14, RF15). Uma falha aqui não
  // desfaz a reserva nem o cancelamento, que já estão gravados (RNF03).
  private async notify(
    event: BookingEvent,
    booking: Booking,
    cancelledBy?: Role,
  ): Promise<void> {
    try {
      const [service] = await this.catalog.findByIds([booking.serviceId]);
      const people = await this.users.findByIds([
        booking.clientId,
        booking.providerId,
      ]);
      const client = people.find((p) => p.id === booking.clientId);
      const provider = people.find((p) => p.id === booking.providerId);
      if (!service || !client || !provider) {
        throw new Error('reserva sem serviço, cliente ou prestador');
      }
      this.notifications.publish(event, {
        bookingId: booking.id,
        to: client.email,
        clientName: client.name,
        providerName: provider.name,
        serviceName: service.name,
        startsAt: booking.startsAt.toISOString(),
        timezone: provider.timezone,
        cancelledBy,
      });
    } catch (error) {
      this.logger.error(
        `Não foi possível pedir o e-mail da reserva ${booking.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
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
