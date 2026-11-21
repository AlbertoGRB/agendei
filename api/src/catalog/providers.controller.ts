import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import { CatalogService } from './catalog.service.js';
import { ProviderDto, toProviderDto } from './dto/provider.dto.js';

// O cliente escolhe o prestador e o serviço (RF07).
@ApiTags('providers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
@ApiForbiddenResponse({ description: 'Só para cliente' })
@Roles(Role.CLIENT)
@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly users: UsersService,
  ) {}

  // Só aparecem prestadores com pelo menos um serviço ativo.
  @Get()
  @ApiOkResponse({ type: [ProviderDto] })
  async list(): Promise<ProviderDto[]> {
    const services = await this.catalog.listActive();
    const providerIds = [...new Set(services.map((s) => s.providerId))];
    const providers = await this.users.findProviders(providerIds);
    return providers.map((provider) =>
      toProviderDto(
        provider,
        services.filter((s) => s.providerId === provider.id),
      ),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: ProviderDto })
  @ApiNotFoundResponse({ description: 'Prestador não encontrado' })
  async get(@Param('id') id: string): Promise<ProviderDto> {
    const provider = await this.users.findProvider(id);
    if (!provider) {
      throw new NotFoundException('Prestador não encontrado');
    }
    return toProviderDto(provider, await this.catalog.listActive(id));
  }
}
