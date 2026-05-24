import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UserRole } from 'src/common/enums/role.enum';
import { SessionService } from 'src/session/session.service';
import { User } from 'src/users/entities/user.entity';
import { DataSource } from 'typeorm';
import { AccountType } from 'src/common/enums/account-type.enum';
import { Role } from 'src/users/entities/user-roles.entity';
import { SignupStrategyFactory } from '../factories/signup.factory';
import { BeneficiariesSignupDto } from '../dto/beneficiaries/beneficiaries-signup.dto';
import { EnrichersSignupDto } from '../dto/enrichers/enrichers-signup.dto';
import { UsersService } from './users.service';
import { Enricher } from '../entities/enricher.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationDelivery } from 'src/notifications/enums/notification-delivery.enum';

export type TokenPayload = {
  sub: string;
  email: string;
  phone: string;
  roles: Role[];
};

@Injectable()
export class AuthProvider {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionService,
    private readonly dataSource: DataSource,
    private readonly strategyFactory: SignupStrategyFactory,
    private readonly notificationsService: NotificationsService,
  ) {}

  generateVerificationToken(userId: string) {
    return this.jwtService.sign(
      {
        sub: userId,
        type: 'email_verification',
      },
      { expiresIn: '1d' },
    );
  }

  async verifyEmail(token: string) {
    const payload = this.jwtService.verify<{
      sub: string;
      userId: string;
      type: string;
    }>(token);

    if (payload.type !== 'email_verification') {
      throw new BadRequestException('Invalid token type');
    }

    const userId = payload.userId ?? payload.sub;
    const user = await this.usersService.findById(userId);

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

    const match = await bcrypt.compare(pass, user.password);

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
      const strategy = this.strategyFactory.getStrategy(dto.accountType);

      switch (dto.accountType) {
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
          await this.notificationsService.enqueue({
            userId: user.id,
            title: 'Welcome 🎉',
            message: `Welcome ${user.name}, we're happy to have you معنا!`,
            delivery: NotificationDelivery.BOTH, // email + inapp
            email: user.email,
          });
          await this.notificationsService.enqueue({
            userId: user.id,
            title: 'verification email',
            message: `Welcome ${user.name}, we're happy to have you معنا!`,
            delivery: NotificationDelivery.VERIFY_EMAIL, // email + inapp
            email: user.email,
          });
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
        organizationName: dto.organizationName,
        user,
      });

      await manager.save(enricher);

      await this.notificationsService.enqueue({
        userId: user.id,
        title: 'Welcome 🎉',
        message: `Welcome ${user.name}, we're happy to have you معنا!`,
        delivery: NotificationDelivery.BOTH, // email + inapp
        email: user.email,
      });
      await this.notificationsService.enqueue({
        userId: user.id,
        title: 'verification email',
        message: `Welcome ${user.name}, we're happy to have you معنا!`,
        delivery: NotificationDelivery.VERIFY_EMAIL, // email + inapp
        email: user.email,
      });
      return { user, enricher };
    });
  }
}
