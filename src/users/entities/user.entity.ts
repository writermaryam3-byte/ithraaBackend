import { Exclude } from 'class-transformer';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToMany,
  JoinTable,
  ManyToOne,
} from 'typeorm';
import { Role } from './user-roles.entity';
import { Enricher } from './enricher.entity';
import { Teacher } from './teacher.entity';
import { ParentProfile } from './parent-profile.entity';
import { OrganizationChild } from '../../children/entities/organization-child.entity';
import { PrivateChild } from '../../children/entities/private-child.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column()
  @Exclude()
  password: string;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({ unique: true })
  phone: string;

  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable()
  roles: Role[];

  /**
   * Organization owner
   */
  @OneToOne(() => Organization, (org) => org.owner)
  ownedOrganization: Organization;

  /**
   * Organization membership
   */
  @ManyToOne(() => Organization, (org) => org.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  organization: Organization;

  @OneToOne(() => Enricher, (enricher) => enricher.user)
  enricher: Enricher;

  @OneToOne(() => Teacher, (teacher) => teacher.user)
  teacher: Teacher;

  @OneToMany(() => OrganizationChild, (child) => child.createdBy)
  organizationChildren: OrganizationChild[];

  @OneToMany(() => PrivateChild, (child) => child.createdBy)
  privateChildren: PrivateChild[];

  @OneToOne(() => ParentProfile, (profile) => profile.user, {
    nullable: true,
  })
  parentProfile: ParentProfile;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
