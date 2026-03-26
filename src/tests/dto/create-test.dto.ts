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
} from 'class-validator';
import { Type } from 'class-transformer';

// ================== Answer ==================
export class CreateAnswerDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsNumber()
  @Min(0)
  score: number;
}

// ================== Question ==================
export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsArray()
  @ArrayMinSize(2) // على الأقل اختيارين
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerDto)
  answers: CreateAnswerDto[];
}

// ================== Test ==================
export class CreateTestDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1) // لازم يكون فيه سؤال واحد على الأقل
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}

// ================== Submit Test ==================
class SubmitAnswerDto {
  @IsUUID()
  questionId: string;

  @IsUUID()
  answerId: string;
}

export class SubmitTestDto {
  @IsUUID()
  assignmentId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];
}

// ================== assignment Test ==================

export class CreateTestAssignmentDto {
  @IsUUID()
  childId: string;

  @IsUUID()
  testId: string;

  @IsDateString()
  due_date: string;
}
