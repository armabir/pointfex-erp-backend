import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { Public } from '../common/public.decorator'
import { CurrentUser } from '../common/current-user.decorator'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { AuthService } from './auth.service'
import { ChangePasswordDto, LoginDto } from './dto/auth.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(dto, request, response)
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.refresh(request, response)
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(request, response)
  }

  @Get('me')
  getMe(@CurrentUser() actor: AuthenticatedUser) {
    return this.authService.getProfile(actor)
  }

  @Get('me/sessions')
  getMySessions(@CurrentUser() actor: AuthenticatedUser) {
    return this.authService.getMySessionsAndLinks(actor)
  }

  @Delete('me/sessions/:id')
  revokeMySession(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.authService.revokeMySession(actor, id)
  }

  @Post('me/sessions/logout-all')
  @HttpCode(HttpStatus.OK)
  logoutAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.logoutAllDevices(actor, request, response)
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ChangePasswordDto & { mfaCode?: string },
    @Headers('x-mfa-code') headerMfaCode?: string,
  ) {
    return this.authService.changePassword(actor, dto, headerMfaCode)
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email)
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body() body: { token: string; newPassword: string; mfaCode?: string },
    @Headers('x-mfa-code') headerMfaCode?: string,
  ) {
    return this.authService.resetPasswordWithToken(body, headerMfaCode)
  }

  @Post('recovery-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  regenerateRecoveryCodes(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { currentPassword?: string; mfaCode?: string },
    @Headers('x-mfa-code') headerMfaCode?: string,
  ) {
    return this.authService.regenerateRecoveryCodes(actor, body, headerMfaCode)
  }

  @Public()
  @Get('google')
  getGoogleAuthUrl(@Res() response: Response) {
    const url = this.authService.getGoogleAuthUrl()
    return response.redirect(HttpStatus.FOUND, url)
  }

  @Public()
  @Get('google/callback')
  googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() response: Response,
  ) {
    return this.authService.handleGoogleCallback({ code, state, oauthError }, response)
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  exchangeGoogleCode(
    @Body() body: { code?: string; pendingToken?: string; mfaCode?: string; recoveryCode?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.exchangeGoogleCode(body, request, response)
  }
}
