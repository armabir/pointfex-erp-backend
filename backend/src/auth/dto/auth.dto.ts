import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(1)
  password!: string

  @IsOptional()
  @IsString()
  mfaCode?: string

  @IsOptional()
  @IsString()
  recoveryCode?: string
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string

  @IsString()
  @MinLength(12)
  newPassword!: string
}
