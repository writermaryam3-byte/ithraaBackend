import { Gender } from 'src/common/enums/gender.enum';
import { Organization } from 'src/organizations/entities/organization.entity';
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
} from 'typeorm';
import { ChildProfile } from './child-profile.entity';
import { Class } from 'src/classes/entities/class.entity';
import { ChildPrivateAttempt } from './child-private-attempt.entity';
import { ChildType } from '../enums/child-type.enum';

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

  @Column({ type: 'enum', enum: ChildType })
  type: ChildType;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization | null;

  @ManyToOne(() => Class, (cls) => cls.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'classId' })
  class: Class | null;

  @ManyToOne(() => User, (user) => user.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => User, (user) => user.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: User;

  @OneToOne(() => ChildProfile, (profile) => profile.child)
  profile: ChildProfile;

  // ⚠️ Deprecated: do NOT use as source of truth
  // kept temporarily for backward compatibility

  @Column({ type: 'int', default: 0 })
  attemptsUsed: number;

  @Column({ default: false })
  retakeUsed: boolean;

  @OneToMany(() => ChildPrivateAttempt, (a) => a.child)
  privateAttempts: ChildPrivateAttempt[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
