import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PrivateChildAttemptsService } from 'src/children/private-child-attempts.service';
import { DataSource, Repository } from 'typeorm';
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity';
import { EvaluationScoringService } from '../evaluations-scoring-services.service';
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum';

@Injectable()
export class EvaluationSubmissionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(EvaluationAttempt)
    private readonly attempts: Repository<EvaluationAttempt>,
    private readonly slots: PrivateChildAttemptsService,
    private readonly scoring: EvaluationScoringService,
  ) {}

  async submit(attemptId: string, parentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EvaluationAttempt);

      const attempt = await repo.findOne({
        where: { id: attemptId, parentId },
        relations: { answers: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!attempt) throw new NotFoundException();
      if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) {
        throw new BadRequestException('Already submitted');
      }

      // ✅ scoring
      const result = this.scoring.calculate(
        attempt.evaluation,
        attempt.answers,
      );
      attempt.status = EvaluationAttemptStatus.SUBMITTED;
      attempt.result = result;

      await repo.save(attempt);

      // ✅ complete slot
      await this.slots.markPrivateAttemptCompleted(
        manager,
        attempt.id,
        attempt.childId,
      );

      return attempt;
    });
  }
}
