import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsEmail()
  email!: string

  @IsString()
  @MinLength(2)
  title!: string

  @IsOptional()
  @IsString()
  roleSlug?: string

  @IsOptional()
  @IsString()
  teamId?: string

  @IsOptional()
  @IsString()
  timezone?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[]

  @IsOptional()
  @IsString()
  bio?: string
}
