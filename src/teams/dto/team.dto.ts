import { IsNotEmpty, IsOptional, IsString, IsInt, Min, Max } from 'class-validator'

export class CreateTeamDto {
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
  focus: string

  @IsNotEmpty()
  @IsString()
  pmPositionId: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  weeklyVelocity?: number
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  focus?: string

  @IsOptional()
  @IsString()
  pmPositionId?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsString()
  health?: string

  @IsOptional()
  @IsInt()
  weeklyVelocity?: number

  @IsOptional()
  @IsInt()
  currentSprintWeek?: number
}

export class AddTeamMemberDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string

  @IsOptional()
  isLead?: boolean

  @IsOptional()
  @IsString()
  roleInTeam?: string
}

