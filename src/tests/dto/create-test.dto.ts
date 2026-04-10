import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNotEmptyObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// ================== Answer ==================
export class CreateAnswerDto {
  @ApiProperty({
    example: 'answer-1',
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({
    example: 2,
  })
  @IsNumber()
  @Min(0)
  score: number;
}

// ================== Question ==================
export class CreateQuestionDto {
  @ApiProperty({
    example: 'question-1',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ type: CreateAnswerDto })
  @IsNotEmptyObject()
  @IsArray()
  @ArrayMinSize(2) // على الأقل اختيارين
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerDto)
  answers: CreateAnswerDto[];
}

// ================== Test ==================
export class CreateTestDto {
  @ApiProperty({
    example: 'test-1',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'description form test-1',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: CreateQuestionDto })
  @IsNotEmptyObject()
  @IsArray()
  @ArrayMinSize(1) // لازم يكون فيه سؤال واحد على الأقل
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}

// ================== Submit Test ==================
class SubmitAnswerDto {
  @ApiProperty({
    description: 'question ID',
    example: 'f120dbc5-4fab-480c-af01-eac3b3942fc6',
    format: 'uuid',
  })
  @IsUUID()
  questionId: string;

  @ApiProperty({
    description: 'answer ID',
    example: 'f120dbc5-4fab-480c-af01-eac3b3942fc6',
    format: 'uuid',
  })
  @IsUUID()
  answerId: string;
}

export class SubmitTestDto {
  @ApiProperty({
    description: 'assignment ID',
    example: 'f120dbc5-4fab-480c-af01-eac3b3942fc6',
    format: 'uuid',
  })
  @IsUUID()
  assignmentId: string;

  @ApiProperty({ type: SubmitAnswerDto })
  @IsNotEmptyObject()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];
}

// ================== assignment Test ==================

export class CreateTestAssignmentDto {
  @ApiProperty({
    description: 'child ID',
    example: 'f120dbc5-4fab-480c-af01-eac3b3942fc6',
    format: 'uuid',
  })
  @IsUUID()
  childId: string;

  @ApiProperty({
    description: 'test ID',
    example: 'f120dbc5-4fab-480c-af01-eac3b3942fc6',
    format: 'uuid',
  })
  @IsUUID()
  testId: string;

  @ApiProperty({
    example: '30-12-2027',
    format: 'date',
  })
  @IsDateString()
  due_date: string;
}
