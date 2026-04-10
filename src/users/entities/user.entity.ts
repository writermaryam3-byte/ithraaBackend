import { Exclude } from 'class-transformer';
import { Child } from 'src/children/entities/child.entity';
import { Employee } from 'src/employees/entities/employee.entity';
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
} from 'typeorm';
import { Role } from './user-roles.entity';
import { Enricher } from './enricher.entity';

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
  password_hash: string;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({ unique: true })
  phone: string;

  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable()
  roles: Role[];

  @OneToOne(() => Organization, (org) => org.owner)
  organization: Organization;

  @OneToOne(() => Enricher, (enricher) => enricher.user)
  enricher: Enricher;

  @OneToOne(() => Employee, (employee) => employee.user)
  employee: Employee;

  @OneToMany(() => Child, (child) => child.user)
  children: Child[];

  @OneToMany(() => Child, (child) => child.parent)
  parentChildren: Child[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
