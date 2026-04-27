import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationsService } from './evaluations.service';
import { EvaluationsController } from './evaluations.controller';
import { AttemptsController } from './attempts.controller';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationAttempt } from './entities/evaluation-attempt.entity';
import { EvaluationAnswer } from './entities/evaluation-answer.entity';
import { EvaluationApproval } from './entities/evaluation-approval.entity';
import { EvaluationQuestion } from './entities/evaluation-question.entity';
import { EvaluationQuestionAnswer } from './entities/evaluation-question-answer.entity';
import { Child } from 'src/children/entities/child.entity';
import { ChildrenModule } from 'src/children/children.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Evaluation,
      EvaluationAttempt,
      EvaluationAnswer,
      EvaluationApproval,
      EvaluationQuestion,
      EvaluationQuestionAnswer,
      Child,
    ]),
    ChildrenModule,
  ],
  controllers: [EvaluationsController, AttemptsController],
  providers: [EvaluationsService],
})
export class EvaluationsModule {}
