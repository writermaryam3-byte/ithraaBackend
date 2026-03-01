import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

// sessions/session.entity.ts
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  refresh_token_hash: string;

  @Column({ nullable: true })
  device: string;

  @Column({ nullable: true })
  ip: string;

  @Column()
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
