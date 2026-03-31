import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UserRole } from 'src/common/enums/role.enum';
import { SessionService } from 'src/session/session.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { type BeneficiariesSignupDto } from './dto/beneficiaries/beneficiaries-signup.dto';
import { DataSource } from 'typeorm';
import { SignupStrategyFactory } from './factories/signup.factory';
import { EnrichersSignupDto } from './dto/enrichers/enrichers-signup.dto';
import { Enricher } from 'src/enrichers/entities/enricher.entity';
import { AccountType } from 'src/common/enums/account-type.enum';
import { MailerService } from 'src/mailer/mailer.service';
import { Role } from 'src/users/entities/user-roles.entity';

export type TokenPayload = {
  sub: string;
  email: string;
  phone: string;
  roles: Role[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionService,
    private readonly dataSource: DataSource,
    private readonly strategyFactory: SignupStrategyFactory,
    private readonly mailerService: MailerService,
  ) {}

  async verifyEmail(token: string) {
    const payload = this.jwtService.verify<{ sub: string; userId: string }>(
      token,
    );

    const user = await this.usersService.findById(payload.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isEmailVerified = true;
    await this.usersService.save(user);

    return { message: 'Email verified successfully', ok: true };
  }

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
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '30d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '60d',
    });

    await this.sessionsService.create({
      userId: user.id,
      device,
      ip,
      refreshToken,
    });

    return {
      accessToken,
      refreshToken,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      expiresIn: '30d',
    };
  }

  async beneficiariesSignup(dto: BeneficiariesSignupDto) {
    return this.dataSource.transaction(async (manager) => {
      const strategy = this.strategyFactory.getStrategy(dto.account_type);

      switch (dto.account_type) {
        case AccountType.ORGANIZATION: {
          const user = await this.usersService.create(
            {
              email: dto.email,
              phone: dto.phone,
              name: dto.name,
              password: dto.password,
            },
            [UserRole.ORGANIZATIONOWNER],
            manager,
          );
          await strategy?.saveExtraData(manager, user, dto);
          await this.mailerService.sendVerificationEmail(user.email, user.id);
          return user;
        }
      }
    });
  }

  async enrichersSignup(dto: EnrichersSignupDto) {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.create(
        {
          email: dto.email,
          phone: dto.phone,
          name: dto.name,
          password: dto.password,
        },
        [UserRole.ENRICHER],
        manager,
      );

      const enricher = manager.create(Enricher, {
        organization_name: dto.organizationName,
        user,
      });

      await manager.save(enricher);

      await this.mailerService.sendVerificationEmail(user.email, user.id);

      return { user, enricher };
    });
  }
}
