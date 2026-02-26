import { Gender } from 'src/common/enums/gender.enum';
import { Organization } from 'src/organizations/entities/organization.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChildProfile } from './child-profile.entity';

@Entity()
export class Child {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  grade: string;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @ManyToOne(() => Organization, { nullable: true })
  organization: Organization;

  @ManyToOne(() => User, (user) => user.children)
  user: User;

  @OneToOne(() => ChildProfile, (profile) => profile.child)
  profile: ChildProfile;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
