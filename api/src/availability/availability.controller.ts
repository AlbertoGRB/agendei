import { Body, Controller, Get, Put } from '@nestjs/common';
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
import { AvailabilityService } from './availability.service.js';
import { AvailabilityDto } from './dto/availability.dto.js';

// Disponibilidade do próprio prestador, em horas locais do fuso dele.
@ApiTags('availability')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
@ApiForbiddenResponse({ description: 'Só para prestador' })
@Roles(Role.PROVIDER)
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  @ApiOkResponse({ type: AvailabilityDto })
  async get(@CurrentUser() user: AuthUser): Promise<AvailabilityDto> {
    return { windows: await this.availability.list(user.id) };
  }

  @Put()
  @ApiOkResponse({ type: AvailabilityDto })
  @ApiBadRequestResponse({
    description:
      'Formato inválido, início depois do fim ou janelas sobrepostas',
  })
  async replace(
    @CurrentUser() user: AuthUser,
    @Body() dto: AvailabilityDto,
  ): Promise<AvailabilityDto> {
    return {
      windows: await this.availability.replace(user.id, dto.windows),
    };
  }
}
