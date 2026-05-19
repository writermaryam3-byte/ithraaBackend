import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity';
import { DataSource, Repository } from 'typeorm';
import { EvaluationApproval } from '../entities/evaluation-approval.entity';
import { EvaluationAttemptStatus } from '../enums/evaluation-attempt-status.enum';

Injectable();
export class EvaluationSubmissionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(EvaluationAttempt)
    private readonly evaluationAttemptRepo: Repository<EvaluationAttempt>,
  ) {}

  async approveAttempt(attemptId: string, adminId: string) {
    return this.dataSource.transaction(async (manager) => {
      const attemptRepository = manager.getRepository(EvaluationAttempt);
      const approvalRepository = manager.getRepository(EvaluationApproval);

      // ✅ lock attempt
      const attempt = await attemptRepository.findOne({
        where: { id: attemptId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!attempt) {
        throw new NotFoundException('Attempt not found');
      }

      if (attempt.status !== EvaluationAttemptStatus.SUBMITTED) {
        throw new BadRequestException('Attempt not ready for approval');
      }

      // ✅ create approval record
      const approval = approvalRepository.create({
        attemptId: attempt.id,
        approvedBy: adminId,
        approvedAt: new Date(),
      });

      await approvalRepository.save(approval);

      // ✅ update attempt
      attempt.status = EvaluationAttemptStatus.APPROVED;
      await attemptRepository.save(attempt);

      return attempt;
    });
  }
}
