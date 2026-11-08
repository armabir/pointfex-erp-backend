import { IsOptional, IsString, IsArray } from 'class-validator'

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  avatarUrl?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsArray()
  skills?: string[]

  @IsOptional()
  @IsString()
  timezone?: string

  @IsOptional()
  @IsString()
  github?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  bio?: string
}

