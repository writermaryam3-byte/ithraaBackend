import { Exclude } from 'class-transformer';
import { Child } from 'src/children/entities/child.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
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

  @OneToMany(() => Child, (child) => child.createdBy)
  children: Child[];

  @OneToMany(() => Child, (child) => child.parent)
  parentChildren: Child[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
