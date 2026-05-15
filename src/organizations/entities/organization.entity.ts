import { Class } from 'src/classes/entities/class.entity';
import { ApprovalStatus } from 'src/common/enums/approval-status.enum';
import { OrganizationType } from 'src/common/enums/organization-type.enum';
import { Grade } from 'src/grades/entities/grade.entity';
import { Teacher } from 'src/users/entities/teacher.entity';
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
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @OneToMany(() => Teacher, (teacher) => teacher.organization)
  teachers: Teacher[];

  @OneToMany(() => Grade, (grade) => grade.organization)
  grades: Grade[];

  @OneToMany(() => Class, (cls) => cls.organization)
  classes: Class[];
}
