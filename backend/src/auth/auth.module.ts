import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'
import { LoginAllowlistController } from './login-allowlist.controller'
import { LoginAllowlistService } from './login-allowlist.service'

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') || '15m') as `${number}m`,
        },
      }),
    }),
  ],
  controllers: [AuthController, LoginAllowlistController],
  providers: [AuthService, JwtStrategy, LoginAllowlistService],
  exports: [AuthService, LoginAllowlistService, JwtModule, PassportModule],
})
export class AuthModule {}
