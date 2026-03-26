import { PartialType } from '@nestjs/mapped-types';
import {
  CreateAnswerDto,
  CreateQuestionDto,
  CreateTestDto,
} from './create-test.dto';

export class UpdateTestDto extends PartialType(CreateTestDto) {}
export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}
export class UpdateAnswerDto extends PartialType(CreateAnswerDto) {}
