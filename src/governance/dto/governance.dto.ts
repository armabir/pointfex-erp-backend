import { IsNotEmpty, IsOptional, IsString, IsArray, IsDateString } from 'class-validator'

export class CreateDirectiveDto {
  @IsNotEmpty()
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNotEmpty()
  @IsString()
  assigneeRole: string // 'pm' | 'cto' | 'cfo' | 'chro' | 'developer'

  @IsOptional()
  @IsString()
  assigneeId?: string

  @IsOptional()
  @IsString()
  priority?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsArray()
  tags?: string[]

  @IsOptional()
  @IsString()
  projectId?: string
}

export class RatifyDecisionDto {
  @IsNotEmpty()
  @IsString()
  actionType: string

  @IsNotEmpty()
  @IsString()
  entityId: string

  @IsOptional()
  @IsString()
  notes?: string
}

