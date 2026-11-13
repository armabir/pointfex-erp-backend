import { AuthorizationScope } from '@prisma/client'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wildcards?: string[]

  @IsOptional()
  @IsBoolean()
  includeCritical?: boolean

  @IsOptional()
  @IsString()
  tier?: string

  @IsOptional()
  @IsString()
  changeReason?: string
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wildcards?: string[]

  @IsOptional()
  @IsBoolean()
  includeCritical?: boolean

  @IsOptional()
  @IsString()
  tier?: string

  @IsOptional()
  @IsString()
  changeReason?: string
}

export class CloneRoleDto {
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
}

export class CreateRoleFromTemplateDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens or underscores',
  })
  slug?: string

  @IsOptional()
  @IsString()
  description?: string
}

export class ToggleRoleActiveDto {
  @IsOptional()
  @IsString()
  reason?: string
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wildcards?: string[]

  @IsOptional()
  @IsBoolean()
  includeCritical?: boolean

  @IsOptional()
  @IsString()
  tier?: string

  @IsOptional()
  @IsString()
  changeReason?: string
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
  @IsEnum(AuthorizationScope)
  scope?: AuthorizationScope

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopeIds?: string[]

  @IsOptional()
  @IsDateString()
  startsAt?: string

  @IsOptional()
  @IsDateString()
  expiresAt?: string

  @IsOptional()
  @IsString()
  reason?: string
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
