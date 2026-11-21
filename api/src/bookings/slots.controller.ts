import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { BookingsService } from './bookings.service.js';
import { SlotsQueryDto } from './dto/slots-query.dto.js';
import { SlotsDto } from './dto/slots.dto.js';

@ApiTags('providers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
@ApiForbiddenResponse({ description: 'Só para cliente' })
@Roles(Role.CLIENT)
@Controller('providers')
export class SlotsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get(':id/slots')
  @ApiOkResponse({ type: SlotsDto })
  @ApiBadRequestResponse({ description: 'Data ou serviço não informado' })
  @ApiNotFoundResponse({
    description:
      'Prestador não existe, ou o serviço não é dele ou está desativado',
  })
  slots(
    @Param('id') providerId: string,
    @Query() query: SlotsQueryDto,
  ): Promise<SlotsDto> {
    return this.bookings.slots(providerId, query.serviceId, query.date);
  }
}
