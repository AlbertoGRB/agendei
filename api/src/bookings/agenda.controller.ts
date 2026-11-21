import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { BookingsService } from './bookings.service.js';
import { AgendaDto } from './dto/agenda.dto.js';
import { DateQueryDto } from './dto/date-query.dto.js';

// Agenda do dia do próprio prestador (RF06).
@ApiTags('agenda')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
@ApiForbiddenResponse({ description: 'Só para prestador' })
@Roles(Role.PROVIDER)
@Controller('agenda')
export class AgendaController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @ApiOkResponse({ type: AgendaDto })
  @ApiBadRequestResponse({ description: 'Data fora do formato AAAA-MM-DD' })
  agenda(
    @CurrentUser() user: AuthUser,
    @Query() query: DateQueryDto,
  ): Promise<AgendaDto> {
    return this.bookings.agenda(user.id, query.date);
  }
}
