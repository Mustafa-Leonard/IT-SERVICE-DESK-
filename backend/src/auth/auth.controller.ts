import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ActivationDto, LoginDto, PasswordResetRequestDto, TokenPasswordDto } from './auth.dto.js';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthPrincipal } from './auth.types.js';
import { Public } from './public.decorator.js';

const refreshCookie = 'itdesk_refresh';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      request.get('user-agent'),
      request.ip,
    );
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertSameOrigin(request);
    const token = request.cookies?.[refreshCookie];
    if (typeof token !== 'string') {
      throw new UnauthorizedException('Refresh session is not available.');
    }
    const result = await this.auth.refresh(token);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertSameOrigin(request);
    await this.auth.logout(request.cookies?.[refreshCookie]);
    response.clearCookie(refreshCookie, this.cookieOptions());
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('password-reset/complete')
  @HttpCode(204)
  async completePasswordReset(@Body() dto: TokenPasswordDto): Promise<void> {
    await this.auth.completePasswordReset(dto.token, dto.password);
  }

  @Public()
  @Post('activation/complete')
  @HttpCode(204)
  async completeActivation(@Body() dto: ActivationDto): Promise<void> {
    await this.auth.completeActivation(dto.token, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  getCurrentUser(@CurrentUser() user: AuthPrincipal) {
    return user;
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(refreshCookie, token, {
      ...this.cookieOptions(),
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict' as const,
      path: '/api/v1/auth',
    };
  }

  private assertSameOrigin(request: Request): void {
    if (
      request.get('origin') !==
      this.config.getOrThrow<string>('FRONTEND_ORIGIN')
    ) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
  }
}
