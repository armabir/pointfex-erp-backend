import { IsNotEmpty, IsString } from 'class-validator'

export class AssignPositionDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string

  @IsNotEmpty()
  @IsString()
  positionId: string
}
