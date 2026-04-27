import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from 'eventemitter2';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationAttempt } from './entities/evaluation-attempt.entity';
import { EvaluationAnswer } from './entities/evaluation-answer.entity';
import { EvaluationApproval } from './entities/evaluation-approval.entity';
import { Child } from 'src/children/entities/child.entity';
import { EvaluationAttemptStatus } from './enums/evaluation-attempt-status.enum';
import { EVALUATION_EVENTS } from './evaluations.events';
import { StartEvaluationDto } from './dto/start-evaluation.dto';
import { SaveProgressDto } from './dto/save-progress.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { UserRole } from 'src/common/enums/role.enum';
import type { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { PrivateChildAttemptsService } from 'src/children/private-child-attempts.service';
type Actor = { userId: string; roles: UserRole[] };

type CreateEvaluationQuestionAnswerInput = {
  text: string;
  isCorrect: boolean;
};

type CreateEvaluationQuestionInput = {
  content: string;
  order?: number;
  answers: CreateEvaluationQuestionAnswerInput[];
};

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly privateChildAttempts: PrivateChildAttemptsService,
    @InjectRepository(Evaluation)
    private readonly evalRepo: Repository<Evaluation>,
    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepo: Repository<EvaluationAttempt>,
    @InjectRepository(EvaluationAnswer)
    private readonly answerRepo: Repository<EvaluationAnswer>,
    @InjectRepository(EvaluationApproval)
    private readonly approvalRepo: Repository<EvaluationApproval>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}

  async createEvaluation(dto: CreateEvaluationDto, actor: Actor) {
    this.assertHasRole(actor, [UserRole.ADMIN]);

    const questions =
      dto.questions as unknown as CreateEvaluationQuestionInput[];

    const evaluation = this.evalRepo.create({
      title: dto.title,
      institutionId: dto.institutionId,
      questions: questions.map((q, idx) => ({
        content: q.content,
        order: q.order ?? idx + 1,
        answers: q.answers.map((a) => ({
          text: a.text,
          isCorrect: a.isCorrect,
        })),
      })),
    });

    // Cascade insert questions/answers.
    return this.evalRepo.save(evaluation);
  }

  async getAllEvaluationsForAdmin(actor: Actor) {
    this.assertHasRole(actor, [UserRole.ADMIN]);

    return this.evalRepo.find({
      order: { title: 'ASC' },
    });
  }

  async getEvaluationDetailsForAdmin(evaluationId: string, actor: Actor) {
    this.assertHasRole(actor, [UserRole.ADMIN]);

    const evaluation = await this.evalRepo.findOne({
      where: { id: evaluationId },
      relations: {
        questions: {
          answers: true,
        },
      },
      order: {
        questions: {
          order: 'ASC',
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    return evaluation;
  }

  async startEvaluation(
    evaluationId: string,
    dto: StartEvaluationDto,
    actor: Actor,
  ) {
    this.assertHasRole(actor, [UserRole.PARENT]);

    const evaluation = await this.evalRepo.findOne({
      where: { id: evaluationId },
    });
    if (!evaluation) throw new NotFoundException('Evaluation not found');

    const child = await this.childRepo.findOne({
      where: { id: dto.childId, parent: { id: actor.userId } },
      relations: { parent: true, organization: true },
    });
    if (!child) throw new ForbiddenException('Child not found for this parent');

    const isPrivateChild = child.organization == null;
    const expiresAt = this.resolveExpiresAt(dto);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EvaluationAttempt);

      const attempts = await repo.find({
        where: { evaluationId, parentId: actor.userId, childId: dto.childId },
        order: { attemptNumber: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      const inProgress = attempts.some(
        (a) => a.status === EvaluationAttemptStatus.IN_PROGRESS,
      );
      if (inProgress) {
        throw new BadRequestException(
          'Finish or submit the current attempt before starting another',
        );
      }

      const count = attempts.length;
      const last = attempts[0];

      if (last?.status === EvaluationAttemptStatus.APPROVED) {
        this.events.emit(EVALUATION_EVENTS.limitReached, {
          evaluationId,
          parentId: actor.userId,
          childId: dto.childId,
          attempts: count,
          reason: 'already_approved',
        });
        throw new BadRequestException('Retake is not allowed after approval');
      }

      let entitlementId: string | null = null;

      if (isPrivateChild) {
        const nextNum = count + 1;
        const entitlement =
          await this.privateChildAttempts.findEntitlementForNext(
            manager,
            dto.childId,
            actor.userId,
            nextNum,
          );
        if (!entitlement) {
          throw new BadRequestException(
            'No evaluation slot is available. Use /attempts/:childId/start, retake, request-extra, complete payment, or wait for admin approval.',
          );
        }
        entitlementId = entitlement.id;
      } else if (count >= 2) {
        this.events.emit(EVALUATION_EVENTS.limitReached, {
          evaluationId,
          parentId: actor.userId,
          childId: dto.childId,
          attempts: count,
          reason: 'max_attempts',
        });
        throw new ConflictException('Maximum attempts reached');
      }

      const attemptNumber = count + 1;
      const attempt = repo.create({
        evaluationId,
        parentId: actor.userId,
        childId: dto.childId,
        attemptNumber,
        status: EvaluationAttemptStatus.IN_PROGRESS,
        expiresAt,
        score: null,
        submittedAt: null,
      });

      await repo.save(attempt);

      if (isPrivateChild && entitlementId) {
        await this.privateChildAttempts.linkEvaluationToEntitlement(
          manager,
          entitlementId,
          attempt.id,
        );
      }

      return attempt;
    });
  }

  async saveProgress(attemptId: string, dto: SaveProgressDto, actor: Actor) {
    this.assertHasRole(actor, [UserRole.PARENT]);

    const attempt = await this.getAttemptOrThrow(attemptId);
    this.assertParentOwnership(attempt, actor);

    await this.maybeAutoSubmitIfExpired(attempt, actor);

    if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt is locked');
    }

    if (!dto.answers || dto.answers.length === 0) {
      return this.getAttempt(attemptId, actor);
    }

    const rows = dto.answers.map((a) => ({
      attemptId: attempt.id,
      questionId: a.questionId,
      answer: a.answer,
      isCorrect: typeof a.isCorrect === 'boolean' ? a.isCorrect : null,
    }));

    await this.answerRepo.upsert(rows, ['attemptId', 'questionId']);
    return this.getAttempt(attemptId, actor);
  }

  async submitAttempt(attemptId: string, dto: SubmitAttemptDto, actor: Actor) {
    this.assertHasRole(actor, [UserRole.PARENT]);

    return this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt);
      const answerRepo = manager.getRepository(EvaluationAnswer);

      const attempt = await attemptRepo.findOne({
        where: { id: attemptId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!attempt) throw new NotFoundException('Attempt not found');
      this.assertParentOwnership(attempt, actor);

      if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) {
        throw new BadRequestException('Attempt is locked');
      }

      const now = new Date();
      const expired =
        attempt.expiresAt instanceof Date &&
        now.getTime() > attempt.expiresAt.getTime();

      const rows = dto.answers.map((a) => ({
        attemptId: attempt.id,
        questionId: a.questionId,
        answer: a.answer,
        isCorrect: typeof a.isCorrect === 'boolean' ? a.isCorrect : null,
      }));

      await answerRepo.upsert(rows, ['attemptId', 'questionId']);

      const score = rows.reduce((acc, r) => acc + (r.isCorrect ? 1 : 0), 0);

      attempt.status = EvaluationAttemptStatus.SUBMITTED;
      attempt.submittedAt = now;
      attempt.score = score;
      await attemptRepo.save(attempt);

      const childRow = await manager.getRepository(Child).findOne({
        where: { id: attempt.childId },
        relations: { organization: true },
      });
      if (childRow?.organization == null) {
        await this.privateChildAttempts.markPrivateAttemptCompleted(
          manager,
          attempt.id,
          attempt.childId,
          attempt.attemptNumber,
        );
      }

      this.events.emit(EVALUATION_EVENTS.submitted, {
        attemptId: attempt.id,
        evaluationId: attempt.evaluationId,
        parentId: attempt.parentId,
        childId: attempt.childId,
        score,
        autoSubmitted: expired,
      });

      return attemptRepo.findOne({
        where: { id: attempt.id },
        relations: { answers: true, approval: true, evaluation: true },
      });
    });
  }

  async approveAttempt(attemptId: string, actor: Actor) {
    this.assertHasRole(actor, [UserRole.ADMIN]);

    return this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt);
      const approvalRepo = manager.getRepository(EvaluationApproval);

      const attempt = await attemptRepo.findOne({
        where: { id: attemptId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!attempt) throw new NotFoundException('Attempt not found');

      if (attempt.status === EvaluationAttemptStatus.APPROVED) {
        throw new ConflictException('Attempt already approved');
      }
      if (attempt.status !== EvaluationAttemptStatus.SUBMITTED) {
        throw new BadRequestException(
          'Only submitted attempts can be approved',
        );
      }

      const existingApproval = await approvalRepo.findOne({
        where: { attemptId: attempt.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingApproval)
        throw new ConflictException('Attempt already approved');

      const approval = approvalRepo.create({
        attemptId: attempt.id,
        approvedBy: actor.userId,
      });
      await approvalRepo.save(approval);

      attempt.status = EvaluationAttemptStatus.APPROVED;
      await attemptRepo.save(attempt);

      this.events.emit(EVALUATION_EVENTS.approved, {
        attemptId: attempt.id,
        evaluationId: attempt.evaluationId,
        parentId: attempt.parentId,
        childId: attempt.childId,
        approvedBy: actor.userId,
        approvedAt: approval.approvedAt,
      });

      return attemptRepo.findOne({
        where: { id: attempt.id },
        relations: { answers: true, approval: true, evaluation: true },
      });
    });
  }

  async getAttempt(attemptId: string, actor: Actor) {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
      relations: { answers: true, approval: true, evaluation: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const isAdmin = actor.roles.includes(UserRole.ADMIN);
    const isParent = actor.roles.includes(UserRole.PARENT);

    if (isAdmin) return attempt;

    if (isParent) {
      this.assertParentOwnership(attempt, actor);
      await this.maybeAutoSubmitIfExpired(attempt, actor);
      return this.getAttemptOrThrow(attemptId);
    }

    // Institution visibility: only after approval (institution scoping can be tightened later)
    if (attempt.status !== EvaluationAttemptStatus.APPROVED) {
      throw new ForbiddenException('Attempt not accessible');
    }

    return attempt;
  }

  private async getAttemptOrThrow(attemptId: string) {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
      relations: { answers: true, approval: true, evaluation: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return attempt;
  }

  private resolveExpiresAt(dto: StartEvaluationDto): Date | null {
    if (dto.expiresAt && dto.expiresInSeconds) {
      throw new BadRequestException(
        'Provide either expiresAt or expiresInSeconds',
      );
    }

    if (dto.expiresAt) {
      const d = new Date(dto.expiresAt);
      if (Number.isNaN(d.getTime()))
        throw new BadRequestException('Invalid expiresAt');
      if (d.getTime() <= Date.now())
        throw new BadRequestException('expiresAt must be in the future');
      return d;
    }

    if (dto.expiresInSeconds) {
      const ms = dto.expiresInSeconds * 1000;
      return new Date(Date.now() + ms);
    }

    return null;
  }

  private assertHasRole(actor: Actor, allowed: UserRole[]) {
    if (!actor.roles.some((r) => allowed.includes(r))) {
      throw new ForbiddenException('Insufficient role');
    }
  }

  private assertParentOwnership(attempt: EvaluationAttempt, actor: Actor) {
    if (attempt.parentId !== actor.userId) {
      throw new ForbiddenException('Attempt not owned by this parent');
    }
  }

  private async maybeAutoSubmitIfExpired(
    attempt: EvaluationAttempt,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _actor: Actor,
  ) {
    if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) return;
    if (!attempt.expiresAt) return;

    const now = new Date();
    if (now.getTime() <= attempt.expiresAt.getTime()) return;

    this.logger.warn(`Auto-submitting expired attempt ${attempt.id}`);

    let submittedId: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt);
      const locked = await attemptRepo.findOne({
        where: { id: attempt.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) return;
      if (locked.status !== EvaluationAttemptStatus.IN_PROGRESS) return;

      locked.status = EvaluationAttemptStatus.SUBMITTED;
      locked.submittedAt = now;
      await attemptRepo.save(locked);
      submittedId = locked.id;

      const childRow = await manager.getRepository(Child).findOne({
        where: { id: locked.childId },
        relations: { organization: true },
      });
      if (childRow?.organization == null) {
        await this.privateChildAttempts.markPrivateAttemptCompleted(
          manager,
          locked.id,
          locked.childId,
          locked.attemptNumber,
        );
      }
    });

    if (!submittedId) return;

    const fresh = await this.attemptRepo.findOneBy({ id: submittedId });
    if (!fresh) return;

    this.events.emit(EVALUATION_EVENTS.submitted, {
      attemptId: fresh.id,
      evaluationId: fresh.evaluationId,
      parentId: fresh.parentId,
      childId: fresh.childId,
      score: fresh.score,
      autoSubmitted: true,
    });
  }
}
