import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateSecurityAlertDto {
  @IsNotEmpty()
  @IsString()
  projectId: string

  @IsNotEmpty()
  @IsString()
  title: string

  @IsNotEmpty()
  @IsString()
  severity: string // 'critical' | 'high' | 'medium' | 'low'

  @IsNotEmpty()
  @IsString()
  category: string // 'dependency' | 'auth' | 'injection' | 'encryption' | 'infrastructure'

  @IsOptional()
  @IsString()
  assignedPmId?: string

  @IsOptional()
  @IsString()
  cveOrPackage?: string

  @IsNotEmpty()
  @IsString()
  description: string

  @IsNotEmpty()
  @IsString()
  recommendation: string
}

export class UpdateSecurityAlertStatusDto {
  @IsNotEmpty()
  @IsString()
  status: string // 'open' | 'investigating' | 'patch_in_progress' | 'resolved'
}

