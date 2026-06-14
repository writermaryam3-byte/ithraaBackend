import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from 'src/common/enums/role.enum';

@Injectable()
export class ParentsServices {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findParentByPhone(phone: string) {
    const parent = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('user.parentProfile', 'parentProfile')
      .leftJoinAndSelect('parentProfile.organizationChildren', 'orgChild')
      .leftJoinAndSelect('parentProfile.privateChildren', 'privateChild')
      .where('user.phone = :phone', { phone })
      .andWhere('role.name = :role', {
        role: UserRole.PARENT,
      })
      .getOne();

    if (!parent) {
      return {
        parent: null,
      };
    }

    const { parentProfile, ...parentInfo } = parent;

    const children = [
      ...(parentProfile?.organizationChildren || []),
      ...(parentProfile?.privateChildren || []),
    ];

    return {
      parent: {
        ...parentInfo,
        parentProfileId: parentProfile?.id ?? null,
      },
      children,
    };
  }
}
