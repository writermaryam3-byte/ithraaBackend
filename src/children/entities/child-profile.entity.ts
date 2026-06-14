import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationChild } from './organization-child.entity';
import { PrivateChild } from './private-child.entity';

@Entity('children_profiles')
export class ChildProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => OrganizationChild, (child) => child.profile, {
    nullable: true,
  })
  @JoinColumn({ name: 'organizationChildId' })
  organizationChild: OrganizationChild;

  @OneToOne(() => PrivateChild, (child) => child.profile, {
    nullable: true,
  })
  @JoinColumn({ name: 'privateChildId' })
  privateChild: PrivateChild;

  @Column({ nullable: true })
  diagnoses: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
