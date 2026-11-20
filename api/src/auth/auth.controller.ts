import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { PublicUserDto, toPublicUser } from '../users/public-user.dto.js';
import { AuthService, type Session } from './auth.service.js';
import { AccessTokenDto } from './dto/access-token.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from './public.decorator.js';
import { REFRESH_TOKEN_DAYS } from './refresh-tokens.service.js';

export const REFRESH_COOKIE = 'refresh_token';

// httpOnly: o JavaScript da página não lê o cookie (ADR 0004).
// path /auth: o navegador só manda o cookie para as rotas de sessão.
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth',
};

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: PublicUserDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiConflictResponse({ description: 'E-mail já cadastrado' })
  async register(@Body() dto: RegisterDto): Promise<PublicUserDto> {
    const user = await this.auth.register(dto);
    return toPublicUser(user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AccessTokenDto,
    description: 'Também grava o cookie refresh_token',
  })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    const session = await this.auth.login(dto);
    return startSession(response, session);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({
    type: AccessTokenDto,
    description: 'Troca o cookie refresh_token por um novo',
  })
  @ApiUnauthorizedResponse({
    description: 'Cookie ausente, expirado, revogado ou já usado',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    const session = await this.auth.refresh(readRefreshCookie(request));
    return startSession(response, session);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiNoContentResponse({ description: 'Sessão encerrada e cookie apagado' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  }
}

function startSession(response: Response, session: Session): AccessTokenDto {
  response.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...refreshCookieOptions,
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
  return { accessToken: session.accessToken };
}

function readRefreshCookie(request: Request): string | undefined {
  const value: unknown = request.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}
