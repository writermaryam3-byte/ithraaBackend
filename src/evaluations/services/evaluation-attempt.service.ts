import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SlotStatus } from 'src/children/enums/child-private-attempt-status.enum';
import { PrivateChildAttemptsService } from 'src/children/private-child-attempts.service';
import { DataSource, Repository } from 'typeorm';
import { AttemptUsageService } from '../attempt-usage.service';
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity';
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum';

@Injectable()
export class EvaluationAttemptService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepo: Repository<EvaluationAttempt>,

    private readonly slotService: PrivateChildAttemptsService,
    private readonly usageService: AttemptUsageService,
  ) {}
  async startAttempt(evaluationId: string, childId: string, parentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EvaluationAttempt);

      // ✅ احسب المحاولات
      const usage = await this.usageService.getUsage(childId, parentId);

      // ✅ هات slot جاهز
      const slot = await this.slotService.findEntitlementForNext(
        manager,
        childId,
        parentId,
      );

      if (!slot) {
        throw new BadRequestException('No available attempt slot');
      }

      // ✅ اعمل attempt
      const attempt = repo.create({
        evaluationId,
        childId,
        parentId,
        attemptNumber: usage.totalAttempts + 1,
        status: EvaluationAttemptStatus.IN_PROGRESS,
      });

      const saved = await repo.save(attempt);

      // ✅ اربط slot
      slot.transitionTo(SlotStatus.CONSUMED);
      slot.evaluationAttemptId = saved.id;

      await manager.save(slot);

      return saved;
    });
  }
}
