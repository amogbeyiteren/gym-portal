import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested, IsNumber, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryOption } from '@prisma/client';

export class PurchaseItemDto {
  @ApiProperty({ example: 'store_item_id_123' })
  @IsString()
  storeItemId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class CreatePurchaseDto {
  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @ApiProperty({ enum: DeliveryOption, example: 'PICKUP' })
  @IsEnum(DeliveryOption)
  deliveryOption: DeliveryOption;

  @ApiProperty({ example: '123 Main St, Lagos, Nigeria', required: false })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;
}

export class VerifyPurchaseDto {
  @ApiProperty({ example: 'gym_purchase_1234567890_abc123' })
  @IsString()
  reference: string;
}