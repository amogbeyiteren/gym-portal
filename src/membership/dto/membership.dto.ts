import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive } from 'class-validator';

export class InitializeMembershipPaymentDto {
  @ApiProperty({ example: 5000, description: 'Membership fee in Naira' })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class VerifyMembershipPaymentDto {
  @ApiProperty({ example: 'gym_membership_1234567890_abc123' })
  @IsString()
  reference: string;
}