import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { Child } from './entities/child.entity';
import { ChildPrivateAttempt } from './entities/child-private-attempt.entity';
import { ChildPrivateAttemptKind } from './enums/child-private-attempt-kind.enum';
import { ChildPrivateAttemptStatus } from './enums/child-private-attempt-status.enum';
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PaymentsService } from 'src/payments/payments.service';
import type { PaymentSuccessEventPayload } from 'src/payments/payments.events';
import { PAYMENT_EVENTS } from 'src/payments/payments.events';

@Injectable()
export class PrivateChildAttemptsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Child)
    private readonly children: Repository<Child>,
    @InjectRepository(ChildPrivateAttempt)
    private readonly privateAttempts: Repository<ChildPrivateAttempt>,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private extraAttemptPriceSar(): number {
    return Number(this.config.get<string>('EXTRA_ATTEMPT_PRICE_SAR') ?? '199');
  }

  async loadPrivateChildOrThrow(
    childId: string,
    parentId: string,
  ): Promise<Child> {
    const child = await this.children.findOne({
      where: { id: childId, parent: { id: parentId }, organization: IsNull() },
    });
    if (!child) {
      throw new ForbiddenException('Private child not found for this parent');
    }
    return child;
  }

  async startMainSlot(childId: string, parentId: string) {
    const child = await this.loadPrivateChildOrThrow(childId, parentId);
    if (child.attemptsUsed > 0) {
      throw new BadRequestException(
        'Main attempt already started or completed for this child',
      );
    }

    const existing = await this.privateAttempts.findOne({
      where: {
        childId,
        parentId,
        kind: ChildPrivateAttemptKind.MAIN,
        evaluationAttemptId: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
    if (existing && existing.status !== ChildPrivateAttemptStatus.COMPLETED) {
      return existing;
    }

    const row = this.privateAttempts.create({
      childId,
      parentId,
      kind: ChildPrivateAttemptKind.MAIN,
      status: ChildPrivateAttemptStatus.PENDING,
      isPaid: false,
      requiresApproval: false,
      evaluationAttemptId: null,
      paymentId: null,
    });
    return this.privateAttempts.save(row);
  }

  async requestRetake(childId: string, parentId: string) {
    const child = await this.loadPrivateChildOrThrow(childId, parentId);
    if (child.attemptsUsed < 1) {
      throw new BadRequestException('Complete the main attempt before retake');
    }
    if (child.retakeUsed) {
      throw new BadRequestException('Retake already used');
    }

    const open = await this.privateAttempts.findOne({
      where: {
        childId,
        parentId,
        kind: ChildPrivateAttemptKind.RETAKE,
        evaluationAttemptId: IsNull(),
      },
    });
    if (open && open.status !== ChildPrivateAttemptStatus.COMPLETED) {
      await this.notifyRetakeRequested(parentId, child.name);
      return open;
    }

    const row = this.privateAttempts.create({
      childId,
      parentId,
      kind: ChildPrivateAttemptKind.RETAKE,
      status: ChildPrivateAttemptStatus.RETAKE,
      isPaid: false,
      requiresApproval: false,
      evaluationAttemptId: null,
      paymentId: null,
    });
    const saved = await this.privateAttempts.save(row);
    await this.notifyRetakeRequested(parentId, child.name);
    return saved;
  }

  async requestExtraAttempt(childId: string, parentId: string) {
    const child = await this.loadPrivateChildOrThrow(childId, parentId);
    if (child.attemptsUsed < 2 || !child.retakeUsed) {
      throw new BadRequestException(
        'Both free attempts must be completed before requesting an extra attempt',
      );
    }

    const pending = await this.privateAttempts.findOne({
      where: {
        childId,
        parentId,
        kind: ChildPrivateAttemptKind.EXTRA,
      },
      order: { createdAt: 'DESC' },
    });
    if (
      pending &&
      pending.status !== ChildPrivateAttemptStatus.COMPLETED &&
      pending.status !== ChildPrivateAttemptStatus.EXTRA_REQUESTED
    ) {
      throw new BadRequestException(
        'An extra attempt is already in progress or awaiting payment',
      );
    }
    if (
      pending &&
      pending.status === ChildPrivateAttemptStatus.EXTRA_REQUESTED
    ) {
      throw new BadRequestException('Extra attempt already awaiting approval');
    }

    const row = this.privateAttempts.create({
      childId,
      parentId,
      kind: ChildPrivateAttemptKind.EXTRA,
      status: ChildPrivateAttemptStatus.EXTRA_REQUESTED,
      isPaid: false,
      requiresApproval: true,
      evaluationAttemptId: null,
      paymentId: null,
    });
    const saved = await this.privateAttempts.save(row);
    await this.notifyExtraRequested(parentId, child.name, saved.id);
    return saved;
  }

  async adminApproveExtraAttempt(
    privateAttemptId: string,
    adminUserId: string,
  ) {
    void adminUserId;
    const attempt = await this.privateAttempts.findOne({
      where: { id: privateAttemptId },
      relations: { child: true, parent: true },
    });
    if (!attempt) throw new NotFoundException('Attempt request not found');
    if (attempt.kind !== ChildPrivateAttemptKind.EXTRA) {
      throw new BadRequestException('Not an extra attempt request');
    }
    if (attempt.status !== ChildPrivateAttemptStatus.EXTRA_REQUESTED) {
      throw new BadRequestException('Extra attempt is not awaiting approval');
    }
    if (!attempt.requiresApproval) {
      throw new BadRequestException('Extra attempt does not require approval');
    }

    attempt.requiresApproval = false;
    attempt.status = ChildPrivateAttemptStatus.PENDING_PAYMENT;
    await this.privateAttempts.save(attempt);

    const checkout = await this.payments.createPaymentForPrivateExtraAttempt(
      attempt.parentId,
      {
        childId: attempt.childId,
        privateAttemptId: attempt.id,
        amount: this.extraAttemptPriceSar(),
        description: 'Extra child evaluation attempt',
      },
    );

    attempt.paymentId = checkout.id;
    await this.privateAttempts.save(attempt);

    await this.notifyPaymentRequired(
      attempt.parentId,
      attempt.child.name,
      checkout.checkoutUrl,
      checkout.expiresAt,
    );

    return {
      attempt,
      payment: checkout,
    };
  }

  async initiateOrRefreshExtraPayment(
    privateAttemptId: string,
    parentId: string,
  ) {
    const attempt = await this.privateAttempts.findOne({
      where: { id: privateAttemptId, parentId },
      relations: { child: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== ChildPrivateAttemptStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Payment is not required for this attempt');
    }
    if (!attempt.paymentId) {
      throw new BadRequestException('No payment record linked to this attempt');
    }

    const refreshed = await this.payments.retryPayment(
      attempt.paymentId,
      parentId,
    );
    await this.notifyPaymentRequired(
      parentId,
      attempt.child.name,
      refreshed.checkoutUrl,
      refreshed.expiresAt,
    );
    return refreshed;
  }

  async findEntitlementForNext(
    manager: EntityManager,
    childId: string,
    parentId: string,
    nextAttemptNumber: number,
  ): Promise<ChildPrivateAttempt | null> {
    const repo = manager.getRepository(ChildPrivateAttempt);
    if (nextAttemptNumber === 1) {
      return repo.findOne({
        where: {
          childId,
          parentId,
          kind: ChildPrivateAttemptKind.MAIN,
          status: ChildPrivateAttemptStatus.PENDING,
          evaluationAttemptId: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });
    }
    if (nextAttemptNumber === 2) {
      return repo.findOne({
        where: {
          childId,
          parentId,
          kind: ChildPrivateAttemptKind.RETAKE,
          status: ChildPrivateAttemptStatus.RETAKE,
          evaluationAttemptId: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });
    }
    return repo.findOne({
      where: {
        childId,
        parentId,
        kind: ChildPrivateAttemptKind.EXTRA,
        status: ChildPrivateAttemptStatus.PENDING,
        isPaid: true,
        evaluationAttemptId: IsNull(),
      },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async linkEvaluationToEntitlement(
    manager: EntityManager,
    entitlementId: string,
    evaluationAttemptId: string,
  ): Promise<void> {
    const repo = manager.getRepository(ChildPrivateAttempt);
    const row = await repo.findOne({
      where: { id: entitlementId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) throw new NotFoundException('Entitlement not found');
    row.evaluationAttemptId = evaluationAttemptId;
    await repo.save(row);
  }

  async markPrivateAttemptCompleted(
    manager: EntityManager,
    evaluationAttemptId: string,
    childId: string,
    attemptNumber: number,
  ): Promise<void> {
    const repo = manager.getRepository(ChildPrivateAttempt);
    const row = await repo.findOne({
      where: { evaluationAttemptId },
      lock: { mode: 'pessimistic_write' },
    });
    if (row) {
      row.status = ChildPrivateAttemptStatus.COMPLETED;
      await repo.save(row);
    }

    const childRepo = manager.getRepository(Child);
    const child = await childRepo.findOne({
      where: { id: childId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!child) return;

    if (attemptNumber === 1) {
      child.attemptsUsed = Math.max(child.attemptsUsed, 1);
    } else if (attemptNumber === 2) {
      child.attemptsUsed = Math.max(child.attemptsUsed, 2);
      child.retakeUsed = true;
    } else {
      child.attemptsUsed = Math.max(child.attemptsUsed, attemptNumber);
    }
    await childRepo.save(child);
  }

  @OnEvent(PAYMENT_EVENTS.SUCCESS)
  async handlePaymentSuccess(
    payload: PaymentSuccessEventPayload,
  ): Promise<void> {
    const privateId = payload.metadata.privateAttemptId;
    if (!privateId || typeof privateId !== 'string') return;

    let unlocked = false;
    let childName: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ChildPrivateAttempt);
      const row = await repo.findOne({
        where: { id: privateId },
        relations: { child: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) return;
      if (row.status !== ChildPrivateAttemptStatus.PENDING_PAYMENT) return;

      row.status = ChildPrivateAttemptStatus.PENDING;
      row.isPaid = true;
      row.paymentId = payload.paymentId;
      await repo.save(row);
      unlocked = true;
      childName = row.child.name;
    });

    if (!unlocked) return;

    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId: payload.userId,
      title: 'Payment successful',
      message: `Payment received. You can start the extra evaluation for ${childName ?? 'your child'}.`,
    });
  }

  private async notifyRetakeRequested(parentId: string, childName: string) {
    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId: parentId,
      title: 'Retake requested',
      message: `A retake has been opened for ${childName}. You can start the evaluation when ready.`,
    });
  }

  private async notifyExtraRequested(
    parentId: string,
    childName: string,
    requestId: string,
  ) {
    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId: parentId,
      title: 'Extra attempt requested',
      message: `An extra evaluation attempt was requested for ${childName} (ref ${requestId}). Awaiting admin approval.`,
    });
  }

  private async notifyPaymentRequired(
    parentId: string,
    childName: string,
    paymentUrl: string,
    expiresAt: Date,
  ) {
    await this.notifications.enqueue({
      delivery: NotificationDelivery.IN_APP,
      userId: parentId,
      title: 'Payment required',
      message: `Complete payment for an extra evaluation attempt for ${childName}. Pay here: ${paymentUrl} (expires ${expiresAt.toISOString()}).`,
    });
  }
}
