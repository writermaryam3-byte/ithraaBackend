import { Injectable } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import bcrypt from 'bcrypt';
@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private repo: Repository<Session>,
  ) {}
  async create(createSessionDto: CreateSessionDto) {
    const hash = await bcrypt.hash(createSessionDto.refreshToken, 10);

    const session = this.repo.create({
      user_id: createSessionDto.userId,
      refresh_token_hash: hash,
      device: createSessionDto.device,
      ip: createSessionDto.ip,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return this.repo.save(session);
  }
  findAll() {
    return `This action returns all session`;
  }

  findOne(id: number) {
    return `This action returns a #${id} session`;
  }
  async findValidSession(userId: string) {
    return this.repo.findOne({
      where: { user_id: userId },
    });
  }

  async deleteSession(sessionId: string) {
    await this.repo.delete(sessionId);
  }

  async deleteAllUserSessions(userId: string) {
    await this.repo.delete({ user_id: userId });
  }
}
