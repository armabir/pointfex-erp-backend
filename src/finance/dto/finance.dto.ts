import { IsNotEmpty, IsOptional, IsString, IsNumber, IsIn, Min } from 'class-validator'

export class AllocateDeveloperBudgetDto {
  @IsNotEmpty()
  @IsString()
  developerId: string

  @IsNotEmpty()
  @IsString()
  projectId: string

  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: 'Allocation amount must be greater than 0' })
  amount: number

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsNumber()
  week?: number
}

export class AllocateProjectBudgetDto {
  @IsNotEmpty()
  @IsString()
  projectId: string

  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: 'New project budget must be greater than 0' })
  newBudget: number

  @IsOptional()
  @IsString()
  reason?: string
}

export class RequestBudgetIncreaseDto {
  @IsNotEmpty()
  @IsString()
  projectId: string

  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: 'Requested amount must be greater than 0' })
  amount: number

  @IsNotEmpty({ message: 'Reason is required for budget requests' })
  @IsString()
  reason: string
}

export class AdjudicateBudgetRequestDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  approvedAmount: number

  @IsOptional()
  @IsString()
  feedback?: string
}

export class RejectBudgetRequestDto {
  @IsNotEmpty({ message: 'Feedback is required when dismissing a budget request' })
  @IsString()
  feedback: string
}

export class IssueFinancialAdjustmentDto {
  @IsNotEmpty()
  @IsString()
  userId: string

  @IsNotEmpty()
  @IsNumber()
  @Min(1, { message: 'Adjustment amount must be positive' })
  amount: number

  @IsNotEmpty()
  @IsString()
  @IsIn(['bonus', 'penalty'])
  type: 'bonus' | 'penalty'

  @IsNotEmpty({ message: 'Reason is required for financial adjustments' })
  @IsString()
  reason: string
}

export class ClientRevenueShareDto {
  @IsNotEmpty()
  @IsString()
  projectId: string

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  clientRevenueAmount: number

  @IsNotEmpty()
  @IsString()
  acquirerEmployeeId: string

  @IsOptional()
  @IsString()
  notes?: string
}
