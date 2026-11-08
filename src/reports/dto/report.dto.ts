import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator'

export class CreateReportDto {
  @IsNotEmpty()
  @IsString()
  title: string

  @IsNotEmpty()
  @IsString()
  description: string

  @IsNotEmpty()
  @IsString()
  type: string // 'project_submission' | 'complaint' | 'pm_report' | 'cto_report'

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsString()
  teamId?: string

  @IsOptional()
  @IsString()
  docsUrl?: string

  @IsOptional()
  @IsString()
  complainTo?: string

  @IsOptional()
  @IsString()
  recipient?: string

  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean

  @IsOptional()
  @IsString()
  confidentialTo?: string // 'chro' | 'ceo'

  @IsOptional()
  @IsString()
  targetUserId?: string
}

export class UpdateReportStatusDto {
  @IsNotEmpty()
  @IsString()
  status: string

  @IsOptional()
  @IsString()
  feedback?: string
}

export class ForwardReportDto {
  @IsNotEmpty()
  @IsString()
  recipient: string

  @IsNotEmpty({ message: 'PM Endorsement is required when forwarding to C-Level' })
  @IsString()
  endorsement: string
}

export class AdjudicateConfidentialGrievanceDto {
  @IsNotEmpty()
  @IsString()
  status: string

  @IsNotEmpty({ message: 'Mediation notes are required for confidential grievance adjudication' })
  @IsString()
  mediationNotes: string
}

