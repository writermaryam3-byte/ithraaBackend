import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}
  async create(createUserDto: CreateUserDto) {
    const hashed = await bcrypt.hash(createUserDto.password as string, 10);

    return this.userRepo.save({
      ...createUserDto,
      password_hash: hashed,
    });
  }

  findAll() {
    return `This action returns all users`;
  }

  async findById(id: string) {
    return this.userRepo.findOneBy({ id });
  }
  async findByPhone(phone: string) {
    return this.userRepo.findOneBy({ phone });
  }
  async findByEmail(email: string) {
    return this.userRepo.findOneBy({ email });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
