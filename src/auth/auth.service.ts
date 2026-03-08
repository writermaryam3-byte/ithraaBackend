import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'src/common/enums/role.enum';
import { SessionService } from 'src/session/session.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { type BeneficiariesSignupDto } from './dto/beneficiaries/beneficiaries-signup.dto';
import { DataSource } from 'typeorm';
import { SignupStrategyFactory } from './factories/signup.factory';

export type TokenPayload = {
  sub: string;
  email: string;
  phone: string;
  role: UserRole;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionService,
    private readonly dataSource: DataSource,
    private readonly strategyFactory: SignupStrategyFactory,
  ) {}
  async validateUser(phone: string, pass: string) {
    const user = await this.usersService.findByPhone(phone);

    if (!user) return null;

    const match = await bcrypt.compare(pass, user.password_hash);

    if (!match) return null;

    return user;
  }

  async isAlreadyExits(phone: string, email: string) {
    const user =
      (await this.usersService.findByPhone(phone)) ||
      (await this.usersService.findByEmail(email));
    return Boolean(user);
  }

  async login(user: User, device?: string, ip?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    await this.sessionsService.create({
      userId: user.id,
      device,
      ip,
      refreshToken,
    });

    return { accessToken, refreshToken };
  }

  async beneficiariesSignup(dto: BeneficiariesSignupDto) {
    return this.dataSource.transaction(async (manager) => {
      const strategy = this.strategyFactory.getStrategy(dto.account_type);

      switch (dto.account_type) {
        case 'organization': {
          const user = await this.usersService.create(
            {
              email: dto.email,
              phone: dto.phone,
              name: dto.name,
              password: dto.password,
            },
            UserRole.ORGANIZATIONOWNER,
            manager,
          );
          await strategy?.saveExtraData(manager, user, dto);
          return user;
        }
      }
    });
  }
}
