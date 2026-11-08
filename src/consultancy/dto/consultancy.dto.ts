import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator'

export class CreateConsultancyDto {
  @IsNotEmpty()
  @IsString()
  title: string

  @IsNotEmpty()
  @IsString()
  teamId: string

  @IsNotEmpty()
  @IsString()
  projectId: string

  @IsNotEmpty()
  @IsString()
  category: string

  @IsNotEmpty()
  @IsString()
  description: string

  @IsOptional()
  @IsString()
  urgency?: string
}

export class UpdateConsultancyDto {
  @IsOptional()
  @IsString()
  status?: string // 'submitted' | 'under_review' | 'accepted' | 'assigned' | 'in_progress' | 'completed' | 'rejected'

  @IsOptional()
  @IsString()
  assignedConsultantId?: string

  @IsOptional()
  @IsString()
  assignedConsultantName?: string

  @IsOptional()
  @IsNumber()
  estimatedHours?: number

  @IsOptional()
  @IsNumber()
  feeBDT?: number

  @IsOptional()
  @IsString()
  targetDate?: string

  @IsOptional()
  @IsString()
  ctoNotes?: string
}

