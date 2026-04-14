import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from 'eventemitter2';
import { DataSource } from 'typeorm';
import { EvaluationsService } from './evaluations.service';
import { UserRole } from 'src/common/enums/role.enum';
import { EvaluationAttemptStatus } from './enums/evaluation-attempt-status.enum';
import { EVALUATION_EVENTS } from './evaluations.events';

const repoMock = <T extends object>(
  overrides: Partial<Record<keyof any, any>> = {},
) =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    upsert: jest.fn(),
    ...overrides,
  }) as any;

describe(EvaluationsService.name, () => {
  const events = { emit: jest.fn() } as unknown as EventEmitter2;

  const evalRepo = repoMock();
  const attemptRepo = repoMock();
  const answerRepo = repoMock();
  const approvalRepo = repoMock();
  const childRepo = repoMock();

  const txAttemptRepo = repoMock();
  const txAnswerRepo = repoMock();
  const txApprovalRepo = repoMock();

  const dataSource = {
    transaction: jest.fn(async (fn) =>
      fn({
        getRepository: (entity: any) => {
          if (entity?.name === 'EvaluationAttempt') return txAttemptRepo;
          if (entity?.name === 'EvaluationAnswer') return txAnswerRepo;
          if (entity?.name === 'EvaluationApproval') return txApprovalRepo;
          return txAttemptRepo;
        },
      }),
    ),
  } as unknown as DataSource;

  const service = new EvaluationsService(
    dataSource,
    events,
    evalRepo,
    attemptRepo,
    answerRepo,
    approvalRepo,
    childRepo,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prevents non-parent from starting evaluation', async () => {
    await expect(
      service.startEvaluation('eval-1', { childId: 'child-1' } as any, {
        userId: 'u1',
        roles: [UserRole.TEACHER],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces max 2 attempts and emits limit_reached', async () => {
    evalRepo.findOne.mockResolvedValue({ id: 'eval-1' });
    childRepo.findOne.mockResolvedValue({
      id: 'child-1',
      parent: { id: 'p1' },
    });
    txAttemptRepo.find.mockResolvedValue([
      { attemptNumber: 2, status: EvaluationAttemptStatus.SUBMITTED },
      { attemptNumber: 1, status: EvaluationAttemptStatus.SUBMITTED },
    ]);

    await expect(
      service.startEvaluation('eval-1', { childId: 'child-1' } as any, {
        userId: 'p1',
        roles: [UserRole.PARENT],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(events.emit).toHaveBeenCalledWith(
      EVALUATION_EVENTS.limitReached,
      expect.objectContaining({
        evaluationId: 'eval-1',
        parentId: 'p1',
        childId: 'child-1',
      }),
    );
  });

  it('disallows retake if last attempt is approved', async () => {
    evalRepo.findOne.mockResolvedValue({ id: 'eval-1' });
    childRepo.findOne.mockResolvedValue({
      id: 'child-1',
      parent: { id: 'p1' },
    });
    txAttemptRepo.find.mockResolvedValue([
      { attemptNumber: 1, status: EvaluationAttemptStatus.APPROVED },
    ]);

    await expect(
      service.startEvaluation('eval-1', { childId: 'child-1' } as any, {
        userId: 'p1',
        roles: [UserRole.PARENT],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks save when attempt is submitted', async () => {
    attemptRepo.findOne.mockResolvedValue({
      id: 'a1',
      parentId: 'p1',
      status: EvaluationAttemptStatus.SUBMITTED,
      expiresAt: null,
      evaluationId: 'eval-1',
      childId: 'child-1',
    });

    await expect(
      service.saveProgress(
        'a1',
        { answers: [{ questionId: 'q1', answer: 'x' }] } as any,
        { userId: 'p1', roles: [UserRole.PARENT] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
