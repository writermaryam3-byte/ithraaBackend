import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from 'eventemitter2';

import { Evaluation } from './entities/evaluation.entity';
import { EvaluationAttempt } from './entities/evaluation-attempt.entity';
import { EvaluationAnswer } from './entities/evaluation-answer.entity';
import { EvaluationApproval } from './entities/evaluation-approval.entity';
import { EvaluationQuestion } from './entities/evaluation-question.entity';
import { EvaluationQuestionAnswer } from './entities/evaluation-question-answer.entity';
import { EvaluationDimension } from './entities/evaluation-dimension.entity';
import { FindOptionsWhere } from 'typeorm';
import { Child } from 'src/children/entities/child.entity';
import { EvaluationAttemptStatus } from './enums/evaluation-attempt-status.enum';
import { EVALUATION_EVENTS } from './evaluations.events';
import { StartEvaluationDto } from './dto/start-evaluation.dto';
import { SaveProgressDto } from './dto/save-progress.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { UserRole } from 'src/common/enums/role.enum';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { PrivateChildAttemptsService } from 'src/children/private-child-attempts.service';
import { EvaluationScoringService } from './evaluations-scoring-services.service';
import { EntityManager } from 'typeorm';
type Actor = { userId: string; roles: UserRole[] };
type AnswerInput = {
  questionId: string;
  selectedAnswerId: string;
};

type EvaluationAnswerRow = {
  attemptId: string;
  questionId: string;
  selectedAnswerId: string;
  evaluationDimensionId: string;
  scoreValue: number;
};
type EvaluationSubmittedPayload = {
  attemptId: string;
  evaluationId: string;
  parentId: string;
  childId: string;
  score: number | null;
  result: Record<string, unknown> | null;
  autoSubmitted: boolean;
};
@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly privateChildAttempts: PrivateChildAttemptsService,
    private readonly scoringService: EvaluationScoringService,

    @InjectRepository(Evaluation)
    private readonly evalRepo: Repository<Evaluation>,

    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepo: Repository<EvaluationAttempt>,

    @InjectRepository(EvaluationAnswer)
    private readonly answerRepo: Repository<EvaluationAnswer>,

    @InjectRepository(EvaluationApproval)
    private readonly approvalRepo: Repository<EvaluationApproval>,

    @InjectRepository(EvaluationQuestion)
    private readonly questionRepo: Repository<EvaluationQuestion>,

    @InjectRepository(EvaluationQuestionAnswer)
    private readonly questionAnswerRepo: Repository<EvaluationQuestionAnswer>,

    @InjectRepository(EvaluationDimension)
    private readonly dimensionRepo: Repository<EvaluationDimension>,

    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}

  async createEvaluation(dto: CreateEvaluationDto, actor: Actor) {
    this.assertHasRole(actor, [UserRole.ADMIN]);

    return this.dataSource.transaction(async (manager) => {
      const evaluationRepo = manager.getRepository(Evaluation);
      const dimensionRepo = manager.getRepository(EvaluationDimension);
      const questionRepo = manager.getRepository(EvaluationQuestion);

      const duplicatedCodes = this.findDuplicates(
        dto.dimensions.map((d) => d.code),
      );
      if (duplicatedCodes.length > 0) {
        throw new BadRequestException(
          `Duplicate dimension codes: ${duplicatedCodes.join(', ')}`,
        );
      }

      const evaluation = await evaluationRepo.save(
        evaluationRepo.create({
          title: dto.title,
          type: dto.type,
          institutionId: dto.institutionId,
          ageFrom: dto.ageFrom ?? null,
          ageTo: dto.ageTo ?? null,
          evaluatorTypes: dto.evaluatorTypes ?? [],
        }),
      );

      const dimensions = await dimensionRepo.save(
        dto.dimensions.map((dimension) =>
          dimensionRepo.create({
            evaluationId: evaluation.id,
            name: dimension.name,
            code: dimension.code,
            minScore: dimension.minScore,
            maxScore: dimension.maxScore,
            interpretationRules: dimension.interpretationRules ?? null,
          }),
        ),
      );

      const dimensionByCode = new Map(dimensions.map((d) => [d.code, d]));

      for (const [index, questionDto] of dto.questions.entries()) {
        const dimension = dimensionByCode.get(questionDto.dimensionCode);

        if (!dimension) {
          throw new BadRequestException(
            `Dimension code "${questionDto.dimensionCode}" not found`,
          );
        }

        await questionRepo.save(
          questionRepo.create({
            evaluationId: evaluation.id,
            evaluationDimensionId: dimension.id,
            content: questionDto.content,
            order: questionDto.order ?? index + 1,
            answers: questionDto.answers.map((answerDto, answerIndex) => ({
              text: answerDto.text,
              scoreValue: answerDto.scoreValue,
              code: answerDto.code ?? null,
              order: answerIndex + 1,
            })),
          }),
        );
      }

      return evaluationRepo.findOne({
        where: { id: evaluation.id },
        relations: {
          dimensions: true,
          questions: {
            answers: true,
            evaluationDimension: true,
          },
        },
        order: {
          questions: {
            order: 'ASC',
            answers: {
              order: 'ASC',
            },
          },
        },
      });
    });
  }

  async getAllEvaluationsForAdmin(actor: Actor) {
    this.assertHasRole(actor, [UserRole.ADMIN]);

    return this.evalRepo.find({
      relations: {
        dimensions: true,
      },
      order: { title: 'ASC' },
    });
  }

  async getEvaluationDetailsForAdmin(evaluationId: string, actor: Actor) {
    this.assertHasRole(actor, [UserRole.ADMIN]);

    const evaluation = await this.evalRepo.findOne({
      where: { id: evaluationId },
      relations: {
        dimensions: true,
        questions: {
          answers: true,
          evaluationDimension: true,
        },
      },
      order: {
        questions: {
          order: 'ASC',
          answers: {
            order: 'ASC',
          },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    return evaluation;
  }

  async getEvaluationForm(evaluationId: string, actor: Actor) {
    const allowed =
      actor.roles.includes(UserRole.PARENT) ||
      actor.roles.includes(UserRole.ADMIN);

    if (!allowed) {
      throw new ForbiddenException('Insufficient role');
    }

    const evaluation = await this.evalRepo.findOne({
      where: { id: evaluationId },
      relations: {
        dimensions: true,
        questions: {
          answers: true,
          evaluationDimension: true,
        },
      },
      order: {
        questions: {
          order: 'ASC',
          answers: {
            order: 'ASC',
          },
        },
      },
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    return {
      id: evaluation.id,
      title: evaluation.title,
      type: evaluation.type,
      institutionId: evaluation.institutionId,
      ageFrom: evaluation.ageFrom,
      ageTo: evaluation.ageTo,
      evaluatorTypes: evaluation.evaluatorTypes,
      dimensions: evaluation.dimensions.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
      })),
      questions: evaluation.questions.map((q) => ({
        id: q.id,
        content: q.content,
        order: q.order,
        dimension: {
          id: q.evaluationDimension.id,
          code: q.evaluationDimension.code,
          name: q.evaluationDimension.name,
        },
        answers: q.answers.map((a) => ({
          id: a.id,
          text: a.text,
          code: a.code,
          order: a.order,
        })),
      })),
    };
  }

  private async buildAnswerRows(
    manager: EntityManager,
    attempt: EvaluationAttempt,
    inputs: AnswerInput[],
  ): Promise<EvaluationAnswerRow[]> {
    if (!inputs.length) return [];

    const questionIds = inputs.map((a) => a.questionId);

    const duplicatedQuestionIds = this.findDuplicates(questionIds);

    if (duplicatedQuestionIds.length > 0) {
      throw new BadRequestException(
        `Duplicate answers for questions: ${duplicatedQuestionIds.join(', ')}`,
      );
    }

    const questions = await manager.getRepository(EvaluationQuestion).find({
      where: {
        id: In(questionIds),
        evaluationId: attempt.evaluationId,
      },
      relations: {
        answers: true,
        evaluationDimension: true,
      },
    });

    const questionMap = new Map<string, EvaluationQuestion>(
      questions.map((q) => [q.id, q]),
    );

    if (questionMap.size !== questionIds.length) {
      throw new BadRequestException(
        'One or more questions do not belong to this evaluation',
      );
    }

    return inputs.map((input) => {
      const question = questionMap.get(input.questionId);

      if (!question) {
        throw new BadRequestException('Invalid question');
      }

      const selected = question.answers.find(
        (answer) => answer.id === input.selectedAnswerId,
      );

      if (!selected) {
        throw new BadRequestException(
          'Selected answer does not belong to question',
        );
      }

      return {
        attemptId: attempt.id,
        questionId: question.id,
        selectedAnswerId: selected.id,
        evaluationDimensionId: question.evaluationDimensionId,
        scoreValue: Number(selected.scoreValue),
      };
    });
  }

  async saveProgress(attemptId: string, dto: SaveProgressDto, actor: Actor) {
    this.assertHasRole(actor, [UserRole.PARENT]);

    const attempt = await this.getAttemptOrThrow(attemptId);
    this.assertParentOwnership(attempt, actor);

    await this.maybeAutoSubmitIfExpired(attempt, actor);

    const freshAttempt = await this.getAttemptOrThrow(attemptId);

    if (freshAttempt.status !== EvaluationAttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt is locked');
    }

    const answers = dto.answers ?? [];

    if (answers.length === 0) {
      return this.getAttempt(attemptId, actor);
    }

    await this.dataSource.transaction(async (manager) => {
      const answerRepo = manager.getRepository(EvaluationAnswer);

      const rows = await this.buildAnswerRows(manager, freshAttempt, answers);

      await answerRepo.upsert(rows, ['attemptId', 'questionId']);
    });

    return this.getAttempt(attemptId, actor);
  }

  async submitAttempt(attemptId: string, dto: SubmitAttemptDto, actor: Actor) {
    this.assertHasRole(actor, [UserRole.PARENT]);

    return this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt);
      const answerRepo = manager.getRepository(EvaluationAnswer);
      const evalRepo = manager.getRepository(Evaluation);

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

      const rows = await this.buildAnswerRows(manager, attempt, dto.answers);

      await answerRepo.upsert(rows, ['attemptId', 'questionId']);

      const savedAnswers = await answerRepo.find({
        where: { attemptId: attempt.id },
        relations: {
          evaluationDimension: true,
          selectedAnswer: true,
        },
      });

      const evaluation = await evalRepo.findOne({
        where: { id: attempt.evaluationId },
        relations: {
          dimensions: true,
        },
      });

      if (!evaluation) {
        throw new NotFoundException('Evaluation not found');
      }

      const result = this.scoringService.calculate(evaluation, savedAnswers);

      const totalScore =
        'totalScore' in result && typeof result.totalScore === 'number'
          ? result.totalScore
          : null;
      attempt.status = EvaluationAttemptStatus.SUBMITTED;
      attempt.submittedAt = now;
      attempt.score = totalScore;
      attempt.result = result;

      await attemptRepo.save(attempt);

      const childRow = await manager.getRepository(Child).findOne({
        where: { id: attempt.childId },
        relations: { class: true },
      });

      if (childRow?.class == null) {
        await this.privateChildAttempts.markPrivateAttemptCompleted(
          manager,
          attempt.id,
          attempt.childId,
        );
      }

      this.events.emit(EVALUATION_EVENTS.submitted, {
        attemptId: attempt.id,
        evaluationId: attempt.evaluationId,
        parentId: attempt.parentId,
        childId: attempt.childId,
        score: totalScore,
        result,
        autoSubmitted: expired,
      });

      return attemptRepo.findOne({
        where: { id: attempt.id },
        relations: {
          answers: {
            selectedAnswer: true,
            evaluationDimension: true,
          },
          approval: true,
          evaluation: true,
        },
      });
    });
  }

  async getAvailableEvaluationsForChild(childId: string, actor: Actor) {
    this.assertHasRole(actor, [UserRole.PARENT]);

    const child = await this.childRepo.findOne({
      where: { id: childId, parent: { id: actor.userId } },
      relations: { parent: true, class: true },
    });

    if (!child) {
      throw new ForbiddenException('Child not found for this parent');
    }

    const age = this.calculateAge(child.birthDate);

    const qb = this.evalRepo
      .createQueryBuilder('evaluation')
      .where('(evaluation.ageFrom IS NULL OR evaluation.ageFrom <= :age)', {
        age,
      })
      .andWhere('(evaluation.ageTo IS NULL OR evaluation.ageTo >= :age)', {
        age,
      });

    if (child.class) {
      qb.andWhere('evaluation.institutionId = :institutionId', {
        institutionId: child.class.organization.id,
      });
    }

    const evaluations = await qb.orderBy('evaluation.title', 'ASC').getMany();

    return {
      childId,
      age,
      evaluations,
    };
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

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    const child = await this.childRepo.findOne({
      where: { id: dto.childId, parent: { id: actor.userId } },
      relations: { parent: true, class: true },
    });

    if (!child) {
      throw new ForbiddenException('Child not found for this parent');
    }

    const isPrivateChild = child.class == null;

    if (
      !isPrivateChild &&
      evaluation.institutionId !== child.organization?.id
    ) {
      throw new ForbiddenException(
        'Evaluation does not belong to child institution',
      );
    }

    const age = this.calculateAge(child.birthDate);

    if (
      (evaluation.ageFrom !== null &&
        evaluation.ageFrom !== undefined &&
        age < evaluation.ageFrom) ||
      (evaluation.ageTo !== null &&
        evaluation.ageTo !== undefined &&
        age > evaluation.ageTo)
    ) {
      throw new ForbiddenException('Evaluation is not suitable for child age');
    }

    const expiresAt = this.resolveExpiresAt(dto);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EvaluationAttempt);

      const attempts = await repo.find({
        where: {
          evaluationId,
          parentId: actor.userId,
          childId: dto.childId,
        },
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
        const entitlement =
          await this.privateChildAttempts.findEntitlementForNext(
            manager,
            dto.childId,
            actor.userId,
          );

        if (!entitlement) {
          throw new BadRequestException(
            'No evaluation slot is available. Open main slot, retake, request extra, complete payment, or wait for admin approval.',
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
        result: null,
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

  async approveAttempt(attemptId: string, actor: Actor) {
    this.assertHasRole(actor, [UserRole.ADMIN]);

    return this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt);
      const approvalRepo = manager.getRepository(EvaluationApproval);

      const attempt = await attemptRepo.findOne({
        where: { id: attemptId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!attempt) {
        throw new NotFoundException('Attempt not found');
      }

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

      if (existingApproval) {
        throw new ConflictException('Attempt already approved');
      }

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
        relations: {
          answers: {
            selectedAnswer: true,
            evaluationDimension: true,
          },
          approval: true,
          evaluation: true,
          child: true,
        },
      });
    });
  }

  private async getAttemptOrThrow(attemptId: string) {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
      relations: {
        answers: {
          selectedAnswer: true,
          evaluationDimension: true,
        },
        approval: true,
        evaluation: true,
        child: {
          organization: true,
          class: true,
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

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

      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid expiresAt');
      }

      if (d.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be in the future');
      }

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
    actor: Actor,
  ) {
    void actor;

    if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) return;
    if (!attempt.expiresAt) return;

    const now = new Date();

    if (now.getTime() <= attempt.expiresAt.getTime()) return;

    this.logger.warn(`Auto-submitting expired attempt ${attempt.id}`);

    let eventPayload: EvaluationSubmittedPayload | null = null;

    await this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(EvaluationAttempt);
      const answerRepo = manager.getRepository(EvaluationAnswer);
      const evalRepo = manager.getRepository(Evaluation);

      const locked = await attemptRepo.findOne({
        where: { id: attempt.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!locked) return;
      if (locked.status !== EvaluationAttemptStatus.IN_PROGRESS) return;

      const savedAnswers = await answerRepo.find({
        where: { attemptId: locked.id },
        relations: {
          evaluationDimension: true,
          selectedAnswer: true,
        },
      });

      const evaluation = await evalRepo.findOne({
        where: { id: locked.evaluationId },
        relations: {
          dimensions: true,
        },
      });

      if (!evaluation) return;

      const result = this.scoringService.calculate(evaluation, savedAnswers);

      const totalScore =
        'totalScore' in result && typeof result.totalScore === 'number'
          ? result.totalScore
          : null;

      locked.status = EvaluationAttemptStatus.SUBMITTED;
      locked.submittedAt = now;
      locked.score = totalScore;
      locked.result = result;

      await attemptRepo.save(locked);

      const childRow = await manager.getRepository(Child).findOne({
        where: { id: locked.childId },
        relations: { organization: true },
      });

      if (childRow?.organization == null) {
        await this.privateChildAttempts.markPrivateAttemptCompleted(
          manager,
          locked.id,
          locked.childId,
        );
      }

      eventPayload = {
        attemptId: locked.id,
        evaluationId: locked.evaluationId,
        parentId: locked.parentId,
        childId: locked.childId,
        score: locked.score,
        result: locked.result as Record<string, unknown> | null,
        autoSubmitted: true,
      };
    });

    if (!eventPayload) return;

    this.events.emit(EVALUATION_EVENTS.submitted, eventPayload);
  }

  async getAttempt(attemptId: string, actor: Actor) {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
      relations: {
        answers: {
          selectedAnswer: true,
          evaluationDimension: true,
        },
        approval: true,
        evaluation: true,
        child: {
          organization: true,
          class: true,
        },
      },
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

    if (attempt.status !== EvaluationAttemptStatus.APPROVED) {
      throw new ForbiddenException('Attempt not accessible');
    }

    // TODO: tighten organization/class scoping for owner/teacher/employee.
    return attempt;
  }

  async getAttemptsForAdmin(
    actor: Actor,
    filters: {
      status?: EvaluationAttemptStatus;
      evaluationId?: string;
      childId?: string;
    },
  ) {
    this.assertHasRole(actor, [UserRole.ADMIN]);

    const where: FindOptionsWhere<EvaluationAttempt> = {};

    if (filters.status) where.status = filters.status;
    if (filters.evaluationId) where.evaluationId = filters.evaluationId;
    if (filters.childId) where.childId = filters.childId;

    const [attempts, count] = await this.attemptRepo.findAndCount({
      where,
      relations: {
        child: true,
        parent: true,
        evaluation: true,
        approval: true,
      },
      order: {
        startedAt: 'DESC',
      },
    });

    return { attempts, count };
  }

  async getAttemptsForChild(childId: string, actor: Actor) {
    const isAdmin = actor.roles.includes(UserRole.ADMIN);
    const isParent = actor.roles.includes(UserRole.PARENT);

    if (!isAdmin && !isParent) {
      throw new ForbiddenException('Insufficient role');
    }

    const child = await this.childRepo.findOne({
      where: isParent
        ? { id: childId, parent: { id: actor.userId } }
        : { id: childId },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const attempts = await this.attemptRepo.find({
      where: {
        childId,
        ...(isParent ? { parentId: actor.userId } : {}),
      },
      relations: {
        evaluation: true,
        approval: true,
      },
      order: {
        startedAt: 'DESC',
      },
    });

    return { attempts, count: attempts.length };
  }

  private calculateAge(birthDate: Date | string) {
    const birth = new Date(birthDate);
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  }

  private findDuplicates(values: string[]) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const value of values) {
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
    }

    return [...duplicates];
  }
}
