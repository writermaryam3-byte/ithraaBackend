import { Child } from 'src/children/entities/child.entity';
import { Grade } from 'src/grades/entities/grade.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Teacher } from 'src/users/entities/teacher.entity';
import {
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Entity,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Grade, (grade) => grade.classes, { onDelete: 'CASCADE' })
  grade: Grade;

  @ManyToOne(() => Teacher, (teacher) => teacher.classes, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'teacherId' })
  teacher: Teacher | null;

  @OneToMany(() => Child, (child) => child.class)
  children: Child[];

  @ManyToOne(() => Organization, (org) => org.classes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orgId' })
  organization: Organization;
}
