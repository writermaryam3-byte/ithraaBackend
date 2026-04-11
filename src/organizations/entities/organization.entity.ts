import { ApprovalStatus } from 'src/common/enums/approval-status.enum';
import { OrganizationType } from 'src/common/enums/organization-type.enum';
import { Employee } from 'src/employees/entities/employee.entity';
import { Grade } from 'src/grades/entities/grade.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationName: string;

  @Column({
    type: 'enum',
    enum: OrganizationType,
  })
  organizationType: OrganizationType;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approvalStatus: ApprovalStatus;

  @OneToOne(() => User, (user) => user.organization, { onDelete: 'CASCADE' })
  @JoinColumn()
  owner: User;

  @OneToMany(() => Employee, (emp) => emp.organization)
  employees: Employee[];

  @OneToMany(() => Grade, (grade) => grade.organization)
  grades: Grade[];
}
