import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PublicUserDto, toPublicUser } from './public-user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOkResponse({ type: PublicUserDto })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  async me(@CurrentUser() current: AuthUser): Promise<PublicUserDto> {
    const user = await this.users.findById(current.id);
    // Token válido de uma conta que não existe mais.
    if (!user) {
      throw new UnauthorizedException();
    }
    return toPublicUser(user);
  }
}
