import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { CatalogService } from './catalog.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { ServiceDto, toServiceDto } from './dto/service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';

// Serviços do próprio prestador. O cliente vê os serviços ativos pela
// rota de prestadores.
@ApiTags('services')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
@ApiForbiddenResponse({ description: 'Só para prestador' })
@Roles(Role.PROVIDER)
@Controller('services')
export class ServicesController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  @ApiCreatedResponse({ type: ServiceDto })
  @ApiBadRequestResponse({ description: 'Nome, duração ou preço inválido' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceDto,
  ): Promise<ServiceDto> {
    return toServiceDto(await this.catalog.create(user.id, dto));
  }

  @Get()
  @ApiOkResponse({ type: [ServiceDto] })
  async list(@CurrentUser() user: AuthUser): Promise<ServiceDto[]> {
    const services = await this.catalog.listByProvider(user.id);
    return services.map(toServiceDto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ServiceDto })
  @ApiBadRequestResponse({ description: 'Nome, duração ou preço inválido' })
  @ApiNotFoundResponse({
    description: 'Serviço não existe ou é de outro prestador',
  })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceDto> {
    return toServiceDto(await this.catalog.update(user.id, id, dto));
  }
}
