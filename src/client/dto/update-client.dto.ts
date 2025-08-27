import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsNumber } from 'class-validator';


export class UpdateClientDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ type: 'string', format: 'binary', description: 'Profile image' })
  @IsOptional()
  @IsString()
  profileImage?: string;


}

export class UpdateClientMembershipAsActiveDto {

  @ApiProperty({ required: true, description: 'Date membership was purchased' })
  @IsString()
  membershipPaidDate: string;

  @ApiProperty({ required: true, description: 'Date membership is due to be renewed' })
  @IsString()
  membershipDueDate: string;

  @ApiProperty({ required: true, description: 'Amount paid for membership' })
  @IsNumber()
  amount: number;

  @ApiProperty({ required: true, description: 'Membership plan' })
  @IsString()
  membershipPlan: string;
  
}
