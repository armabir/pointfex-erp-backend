import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, Max, IsArray } from 'class-validator'

export class RecordEvaluationDto {
  @IsNotEmpty()
  @IsString()
  userId: string

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number

  @IsNotEmpty()
  @IsString()
  tier: string // 'top_performer' | 'strong_contributor' | 'needs_support'

  @IsNotEmpty()
  @IsString()
  notes: string

  @IsOptional()
  @IsArray()
  strengths?: string[]

  @IsOptional()
  @IsArray()
  improvementAreas?: string[]
}

export class IssueRecognitionDto {
  @IsNotEmpty()
  @IsString()
  userId: string

  @IsNotEmpty()
  @IsString()
  title: string

  @IsNotEmpty()
  @IsString()
  description: string

  @IsOptional()
  @IsNumber()
  bonusAmount?: number
}

export class IssueDisciplinaryDto {
  @IsNotEmpty()
  @IsString()
  userId: string

  @IsNotEmpty()
  @IsString()
  title: string

  @IsNotEmpty()
  @IsString()
  description: string

  @IsOptional()
  @IsNumber()
  penaltyAmount?: number
}

