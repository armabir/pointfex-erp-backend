import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, IsDateString } from 'class-validator'

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNotEmpty()
  @IsString()
  projectId: string

  @IsNotEmpty()
  @IsString()
  assigneeId: string

  @IsOptional()
  @IsString()
  milestoneId?: string

  @IsOptional()
  @IsString()
  priority?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsNumber()
  estimatedHours?: number

  @IsOptional()
  @IsArray()
  tags?: string[]

  @IsOptional()
  checklist?: { text: string; completed?: boolean }[]
}

export class UpdateTaskStatusDto {
  @IsNotEmpty()
  @IsString()
  status: string // 'todo' | 'in_progress' | 'in_review' | 'completed' | 'blocked'
}

export class ApproveTaskDto {
  @IsOptional()
  @IsString()
  feedback?: string

  @IsOptional()
  @IsNumber()
  payoutAmount?: number
}

export class RejectTaskDto {
  @IsNotEmpty({ message: 'Feedback is required when rejecting a task' })
  @IsString()
  feedback: string
}

export class ReassignTaskDto {
  @IsNotEmpty()
  @IsString()
  newAssigneeId: string
}

export class SubmitTaskWorkDto {
  @IsOptional()
  @IsString()
  prUrl?: string

  @IsOptional()
  @IsString()
  demoUrl?: string

  @IsOptional()
  @IsString()
  notes?: string
}

export class AddTaskCommentDto {
  @IsNotEmpty()
  @IsString()
  content: string
}

