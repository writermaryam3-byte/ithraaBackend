import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/common/enums/role.enum';
import { SessionService } from 'src/session/session.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';

export type TokenPayload = {
  sub: string;
  email: string;
  phone: string;
  role: Role;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionService,
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

  async signup(user: CreateUserDto) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, password_hash, ...userWithoutPassword } =
      await this.usersService.create(user);
    return userWithoutPassword;
  }
}
