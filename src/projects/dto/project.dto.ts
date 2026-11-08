import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, IsDateString } from 'class-validator'

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  id?: string

  @IsNotEmpty()
  @IsString()
  name: string

  @IsNotEmpty()
  @IsString()
  code: string

  @IsNotEmpty()
  @IsString()
  description: string

  @IsOptional()
  @IsString()
  teamId?: string

  @IsOptional()
  @IsNumber()
  budget?: number

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  deadline?: string

  @IsOptional()
  @IsString()
  repositoryUrl?: string

  @IsOptional()
  @IsString()
  demoUrl?: string

  @IsOptional()
  @IsArray()
  tags?: string[]

  @IsOptional()
  @IsString()
  srsUrl?: string

  @IsOptional()
  @IsString()
  srsTitle?: string
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsNumber()
  progress?: number

  @IsOptional()
  @IsString()
  health?: string

  @IsOptional()
  @IsDateString()
  deadline?: string

  @IsOptional()
  @IsString()
  repositoryUrl?: string

  @IsOptional()
  @IsString()
  demoUrl?: string

  @IsOptional()
  @IsArray()
  tags?: string[]

  @IsOptional()
  @IsString()
  srsUrl?: string

  @IsOptional()
  @IsString()
  srsTitle?: string
}

export class CreateMilestoneDto {
  @IsNotEmpty()
  @IsString()
  title: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsNumber()
  payoutAmount?: number
}

export class UpdateMilestoneStatusDto {
  @IsNotEmpty()
  @IsString()
  status: string // 'completed' | 'in_progress' | 'pending'
}

export class AssignProjectTeamDto {
  @IsNotEmpty()
  @IsString()
  teamId: string
}

