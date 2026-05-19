import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvaluationAttempt } from './entities/evaluation-attempt.entity';
import { EvaluationAttemptStatus } from './enums/evaluation-attempt-status.enum';

@Injectable()
export class AttemptUsageService {
  constructor(
    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepo: Repository<EvaluationAttempt>,
  ) {}

  async getUsage(childId: string, parentId: string) {
    const attempts = await this.attemptRepo.find({
      where: { childId, parentId },
      order: { attemptNumber: 'ASC' },
    });

    const completedAttempts = attempts.filter(
      (a) =>
        a.status === EvaluationAttemptStatus.SUBMITTED ||
        a.status === EvaluationAttemptStatus.APPROVED,
    );

    return {
      totalAttempts: completedAttempts.length,
      hasRetake: completedAttempts.length >= 2,
      lastAttempt: attempts[attempts.length - 1] || null,
    };
  }
}
