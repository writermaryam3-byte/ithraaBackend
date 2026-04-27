import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Child } from './child.entity';
import { ChildPrivateAttemptStatus } from '../enums/child-private-attempt-status.enum';
import { ChildPrivateAttemptKind } from '../enums/child-private-attempt-kind.enum';

@Entity('child_private_attempts')
@Index('idx_child_private_attempt_child_status', ['childId', 'status'])
export class ChildPrivateAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  childId: string;

  @ManyToOne(() => Child, (c) => c.privateAttempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'childId' })
  child: Child;

  @Index()
  @Column({ type: 'uuid' })
  parentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: User;

  @Column({ type: 'enum', enum: ChildPrivateAttemptKind })
  kind: ChildPrivateAttemptKind;

  @Column({ type: 'enum', enum: ChildPrivateAttemptStatus })
  status: ChildPrivateAttemptStatus;

  @Column({ default: false })
  isPaid: boolean;

  @Column({ default: false })
  requiresApproval: boolean;

  @Column({ type: 'uuid', nullable: true })
  evaluationAttemptId: string | null;

  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
