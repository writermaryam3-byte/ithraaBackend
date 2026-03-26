import { Exclude } from 'class-transformer';
import { Child } from 'src/children/entities/child.entity';
import { UserRole } from 'src/common/enums/role.enum';
import { Employee } from 'src/employees/entities/employee.entity';
import { Enricher } from 'src/enrichers/entities/enricher.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password_hash: string;

  @Column({ unique: true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.PARENT })
  role: UserRole;

  @OneToOne(() => Organization, (org) => org.owner)
  organization: Organization;

  @OneToOne(() => Enricher, (enricher) => enricher.user)
  enricher: Enricher;

  @OneToOne(() => Employee, (employee) => employee.user)
  employee: Employee;

  @OneToMany(() => Child, (child) => child.user)
  children: Child[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
