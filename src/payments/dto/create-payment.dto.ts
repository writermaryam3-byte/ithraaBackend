import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentProviderEnum } from '../enums/payment-provider.enum';

export class CreatePaymentDto {
  @ApiProperty({ example: 199.5, description: 'Amount in SAR (major units)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ default: 'SAR', enum: ['SAR'] })
  @IsOptional()
  @IsIn(['SAR'])
  currency?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  childId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optional business reference (e.g. evaluation attempt id)',
  })
  @IsOptional()
  @IsUUID()
  attemptRequestId?: string;

  @ApiPropertyOptional({ example: 'Evaluation access' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: PaymentProviderEnum })
  @IsOptional()
  @IsEnum(PaymentProviderEnum)
  provider?: PaymentProviderEnum;
}
