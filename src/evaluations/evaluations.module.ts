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
import { EvaluationDimension } from './entities/evaluation-dimension.entity';
import { EvaluationScoringService } from './evaluations-scoring-services.service';
import { OwnerEvaluationResultsController } from './owner-evaluation-results.controller';
import { OwnerEvaluationResultsService } from './owner-evaluation-results.service';
import { Class } from 'src/classes/entities/class.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';

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
      Class,
      Organization,
      EvaluationDimension,
    ]),
    ChildrenModule,
    NotificationsModule,
  ],
  controllers: [
    EvaluationsController,
    AttemptsController,
    OwnerEvaluationResultsController,
  ],
  providers: [
    EvaluationsService,
    EvaluationScoringService,
    OwnerEvaluationResultsService,
  ],
})
export class EvaluationsModule {}
