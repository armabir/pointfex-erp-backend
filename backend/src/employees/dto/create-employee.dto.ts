import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^(?!\d+$).+/, { message: 'Name must include letters, not numbers only' })
  name!: string

  @IsEmail()
  @MaxLength(160)
  email!: string

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/^(?!\d+$).+/, { message: 'Job title must include letters, not numbers only' })
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleSlug?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  teamId?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  skills?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
