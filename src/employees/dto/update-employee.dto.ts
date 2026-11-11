import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  github?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string
}
