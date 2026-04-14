import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEvaluationQuestionAnswerDto {
  @ApiProperty({ example: 'Option A' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ example: false, default: false })
  @IsBoolean()
  isCorrect: boolean;
}

export class CreateEvaluationQuestionDto {
  @ApiProperty({ example: 'What is 2 + 2?' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number;

  @ApiProperty({ type: [CreateEvaluationQuestionAnswerDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateEvaluationQuestionAnswerDto)
  answers: CreateEvaluationQuestionAnswerDto[];
}

export class CreateEvaluationDto {
  @ApiProperty({ example: 'Math Evaluation - Grade 1' })
  @IsString()
  @MinLength(2)
  title: string;

  @ApiProperty({ format: 'uuid', example: 'f120dbc5-4fab-480c-af01-eac3b3942fc6' })
  @IsUUID()
  institutionId: string;

  @ApiProperty({ type: [CreateEvaluationQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEvaluationQuestionDto)
  questions: CreateEvaluationQuestionDto[];
}

