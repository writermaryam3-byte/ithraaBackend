import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from 'src/common/enums/role.enum';
import { IUserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto, role: UserRole[], manager: EntityManager) {
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = manager.create(User, {
      ...dto,
      password_hash: hashed,
      role,
    });
    return manager.save(user);
  }

  async findAll(): Promise<{ users: IUserResponseDto[] }> {
    return { users: await this.userRepo.find() };
  }

  async findUsersByRoles() {
    const users = await this.userRepo.find({ relations: ['enricher'] });
    const employees = users.filter((user) =>
      user.role.includes(UserRole.EMPLOYEE),
    );
    const organizationOwners = users.filter((user) =>
      user.role.includes(UserRole.ORGANIZATIONOWNER),
    );
    const enrichers = users.filter((user) =>
      user.role.includes(UserRole.ENRICHER),
    );
    return {
      employees,
      organizationOwners,
      enrichers,
    };
  }

  async getOrganizationOwner(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['organization'],
    });
    return { user };
  }

  async findById(id: string) {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) throw new NotFoundException('user not found');
    return user;
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

  remove(id: string) {
    return this.userRepo.delete(id);
  }
}
