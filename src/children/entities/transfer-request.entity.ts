import { Child } from 'src/children/entities/child.entity';
import { TransferRequestStatus } from 'src/children/enums/transfer-request-status.enum';
import { Organization } from 'src/organizations/entities/organization.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('transfer_requests')
export class TransferRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  childId: string;

  @ManyToOne(() => Child, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'childId' })
  child: Child;

  @Index()
  @Column({ type: 'uuid' })
  fromOrganizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fromOrganizationId' })
  fromOrganization: Organization;

  @Index()
  @Column({ type: 'uuid' })
  toOrganizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'toOrganizationId' })
  toOrganization: Organization;

  @Column({
    type: 'enum',
    enum: TransferRequestStatus,
    default: TransferRequestStatus.PENDING,
  })
  status: TransferRequestStatus;

  @CreateDateColumn()
  createdAt: Date;
}
