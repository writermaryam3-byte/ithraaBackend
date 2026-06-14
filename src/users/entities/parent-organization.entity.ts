import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { ParentProfile } from './parent-profile.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { ParentOrganizationStatus } from '../enums/parent-organization-status.enum';
import { ParentOrganizationSource } from '../enums/parent-organization-source.enum';

@Entity('parent_organizations')
@Unique('uq_parent_organization', ['parentId', 'organizationId'])
@Index('idx_parent_org_lookup', ['parentId', 'organizationId'])
@Index('idx_org_parents', ['organizationId'])
export class ParentOrganization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  parentId: string;

  @ManyToOne(() => ParentProfile, (p) => p.organizationLinks, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'parentId' })
  parent: ParentProfile;

  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({
    type: 'enum',
    enum: ParentOrganizationStatus,
    default: ParentOrganizationStatus.ACTIVE,
  })
  status: ParentOrganizationStatus;

  @Column({
    type: 'enum',
    enum: ParentOrganizationSource,
    nullable: true,
  })
  source: ParentOrganizationSource | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
