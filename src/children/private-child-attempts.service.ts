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
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PaymentsService } from 'src/payments/payments.service';
import type { PaymentSuccessEventPayload } from 'src/payments/payments.events';
import { PAYMENT_EVENTS } from 'src/payments/payments.events';
import { AttemptUsageService } from 'src/evaluations/attempt-usage.service';
import { SlotKind } from '../evaluations/enums/evaluation-slot-kind.enum';
import { SlotStatus } from '../evaluations/enums/evaluation-slot-status.enum';
import { EvaluationSlot } from 'src/evaluations/entities/evaluation-slot.entity';
import { ChildrenService } from './children.service';

@Injectable()
export class PrivateChildAttemptsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Child)
    private readonly children: Repository<Child>,
    @InjectRepository(EvaluationSlot)
    private readonly privateAttempts: Repository<EvaluationSlot>,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly attemptUsageService: AttemptUsageService,
    private readonly childrenService: ChildrenService,
    private readonly config: ConfigService,
  ) {}

  async assertCanStartAttempt(child: Child, parentId: string) {
    const usage = await this.attemptUsageService.getUsage(child.id, parentId);

    if (!(await this.childrenService.isPrivateChild(child.id))) {
      if (usage.totalAttempts >= 2) {
        throw new BadRequestException('Max attempts reached');
      }
    }
  }

  private extraAttemptPriceSar(): number {
    return Number(this.config.get<string>('EXTRA_ATTEMPT_PRICE_SAR') ?? '199');
  }

  async loadPrivateChildOrThrow(
    childId: string,
    parentId: string,
  ): Promise<Child> {
    const child = await this.children.findOne({
      where: { id: childId, parent: { id: parentId }, classId: IsNull() },
    });
    if (!child) {
      throw new ForbiddenException('Private child not found for this parent');
    }
    return child;
  }

  async startMainSlot(childId: string, parentId: string) {
    const usage = await this.attemptUsageService.getUsage(childId, parentId);
    if (usage.totalAttempts > 0) {
      throw new BadRequestException(
        'Main attempt already started or completed for this child',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(EvaluationSlot);

      const existing = await this.privateAttempts.findOne({
        where: {
          childId,
          parentId,
          kind: SlotKind.MAIN,
          evaluationAttemptId: IsNull(),
        },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      if (existing && existing.status !== SlotStatus.COMPLETED) {
        return existing;
      }

      const row = repo.create({
        childId,
        parentId,
        kind: SlotKind.MAIN,
        status: SlotStatus.READY,
        isPaid: false,
        requiresApproval: false,
        evaluationAttemptId: null,
        paymentId: null,
      });
      return repo.save(row);
    });
  }

  async requestRetake(childId: string, parentId: string) {
    const child = await this.loadPrivateChildOrThrow(childId, parentId);
    const usage = await this.attemptUsageService.getUsage(childId, parentId);

    if (usage.totalAttempts < 1) {
      throw new BadRequestException('Complete the main attempt before retake');
    }
    if (usage.hasRetake) {
      throw new BadRequestException('Retake already used');
    }

    const open = await this.privateAttempts.findOne({
      where: {
        childId,
        parentId,
        kind: SlotKind.RETAKE,
        evaluationAttemptId: IsNull(),
      },
    });
    if (open && open.status !== SlotStatus.COMPLETED) {
      await this.notifyRetakeRequested(parentId, child.name);
      return open;
    }

    const row = this.privateAttempts.create({
      childId,
      parentId,
      kind: SlotKind.RETAKE,
      status: SlotStatus.READY,
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
    const usage = await this.attemptUsageService.getUsage(childId, parentId);

    if (usage.totalAttempts < 2 || !usage.hasRetake) {
      throw new BadRequestException(
        'Both free attempts must be completed before requesting an extra attempt',
      );
    }

    const pending = await this.privateAttempts.findOne({
      where: {
        childId,
        parentId,
        kind: SlotKind.EXTRA,
      },
      order: { createdAt: 'DESC' },
    });
    if (
      pending &&
      pending.status !== SlotStatus.COMPLETED &&
      pending.status !== SlotStatus.REQUESTED
    ) {
      throw new BadRequestException(
        'An extra attempt is already in progress or awaiting payment',
      );
    }
    if (pending && pending.status === SlotStatus.REQUESTED) {
      throw new BadRequestException('Extra attempt already awaiting approval');
    }

    const row = this.privateAttempts.create({
      childId,
      parentId,
      kind: SlotKind.EXTRA,
      status: SlotStatus.REQUESTED,
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
    if (attempt.kind !== SlotKind.EXTRA) {
      throw new BadRequestException('Not an extra attempt request');
    }
    if (attempt.status !== SlotStatus.REQUESTED) {
      throw new BadRequestException('Extra attempt is not awaiting approval');
    }
    if (!attempt.requiresApproval) {
      throw new BadRequestException('Extra attempt does not require approval');
    }
    await this.dataSource.transaction(async (manager) => {
      attempt.transitionTo(SlotStatus.AWAITING_PAYMENT);

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

      await manager.save(attempt);
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
    });
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
    if (attempt.status !== SlotStatus.AWAITING_PAYMENT) {
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
  ): Promise<EvaluationSlot | null> {
    const repo = manager.getRepository(EvaluationSlot);

    return repo.findOne({
      where: {
        childId,
        parentId,
        status: SlotStatus.READY,
        evaluationAttemptId: IsNull(),
      },

      order: {
        createdAt: 'ASC',
      },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async linkEvaluationToEntitlement(
    manager: EntityManager,
    entitlementId: string,
    evaluationAttemptId: string,
  ): Promise<void> {
    const repo = manager.getRepository(EvaluationSlot);
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
  ): Promise<void> {
    const repo = manager.getRepository(EvaluationSlot);
    const row = await repo.findOne({
      where: { evaluationAttemptId },
      lock: { mode: 'pessimistic_write' },
    });
    if (row) {
      row.transitionTo(SlotStatus.COMPLETED);
      await repo.save(row);
    }

    const childRepo = manager.getRepository(Child);
    const child = await childRepo.findOne({
      where: { id: childId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!child) return;
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
      const repo = manager.getRepository(EvaluationSlot);
      const row = await repo.findOne({
        where: { id: privateId },
        relations: { child: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) return;
      if (row.status !== SlotStatus.AWAITING_PAYMENT) return;

      row.transitionTo(SlotStatus.READY);
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
