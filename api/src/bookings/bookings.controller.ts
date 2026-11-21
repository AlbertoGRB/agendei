import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { BookingsService } from './bookings.service.js';
import { BookingDto } from './dto/booking.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

@ApiTags('bookings')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @Roles(Role.CLIENT)
  // Limite de criação, como no login e no cadastro: 30 por minuto por IP.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiCreatedResponse({ type: BookingDto })
  @ApiBadRequestResponse({
    description: 'Horário que já passou ou fora da agenda do prestador',
  })
  @ApiNotFoundResponse({ description: 'Serviço não existe ou está desativado' })
  @ApiConflictResponse({ description: 'Esse horário acabou de ser reservado' })
  @ApiForbiddenResponse({ description: 'Só para cliente' })
  @ApiTooManyRequestsResponse({ description: 'Reservas demais em 1 minuto' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingDto> {
    return this.bookings.create(user.id, dto.serviceId, new Date(dto.startsAt));
  }
}
