import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator'

export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens or underscores',
  })
  slug?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[]
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class SetRolePermissionsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[]
}

export class AttachRolePermissionDto {
  @IsOptional()
  @IsString()
  permissionId?: string

  @IsOptional()
  @IsString()
  permissionCode?: string
}

export class AssignEmployeeRoleDto {
  @IsOptional()
  @IsString()
  roleId?: string

  @IsOptional()
  @IsString()
  roleSlug?: string

  @IsOptional()
  @IsDateString()
  expiresAt?: string
}

export class GrantDirectPermissionDto {
  @IsOptional()
  @IsString()
  permissionId?: string

  @IsOptional()
  @IsString()
  permissionCode?: string

  @IsOptional()
  @IsDateString()
  expiresAt?: string

  @IsOptional()
  @IsString()
  reason?: string
}

export class DeleteRoleDto {
  @IsOptional()
  @IsString()
  verificationToken?: string

  @IsOptional()
  @IsString()
  passwordConfirm?: string
}

export class LifecycleActionDto {
  @IsOptional()
  @IsString()
  reason?: string

  @IsOptional()
  @IsString()
  verificationToken?: string

  @IsOptional()
  @IsString()
  passwordConfirm?: string
}
