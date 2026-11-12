import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

export class CreateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^(?!\d+$).+/, { message: 'Squad name must include letters, not numbers only' })
  name: string

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(16)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'Squad code must be alphanumeric or hyphens' })
  code: string

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  focus: string

  @IsOptional()
  @IsString()
  pmPositionId?: string

  @IsOptional()
  @IsString()
  pmEmployeeId?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
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
  pmPositionId?: string | null

  @IsOptional()
  @IsString()
  pmEmployeeId?: string | null

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
  @IsBoolean()
  isLead?: boolean

  @IsOptional()
  @IsString()
  roleInTeam?: string
}
