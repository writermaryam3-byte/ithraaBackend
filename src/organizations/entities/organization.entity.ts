import { ApprovalStatus } from 'src/common/enums/approval-status.enum';
import { OrganizationType } from 'src/common/enums/organization-type.enum';
import { Employee } from 'src/employees/entities/employee.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: OrganizationType,
  })
  type: OrganizationType;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approval_status: ApprovalStatus;

  @ManyToOne(() => User, (user) => user.organizations)
  owner: User;

  @OneToMany(() => Employee, (emp) => emp.organization)
  employees: Employee[];
}
