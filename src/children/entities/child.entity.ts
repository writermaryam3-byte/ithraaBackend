import { Gender } from 'src/common/enums/gender.enum';
import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { ChildProfile } from './child-profile.entity';
import { Class } from 'src/classes/entities/class.entity';
import { EvaluationSlot } from 'src/evaluations/entities/evaluation-slot.entity';

@Entity('children')
export class Child {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  classId: string | null;

  @ManyToOne(() => Class, (cls) => cls.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'classId' })
  class: Class | null;

  @Index()
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, (user) => user.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Index()
  @Column({ type: 'uuid' })
  parentId: string;

  @ManyToOne(() => User, (user) => user.parentChildren, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentId' })
  parent: User;

  @OneToOne(() => ChildProfile, (profile) => profile.child)
  profile: ChildProfile;

  @OneToMany(() => EvaluationSlot, (a) => a.child)
  slots: EvaluationSlot[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
