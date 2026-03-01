import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, TokenPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from 'src/session/session.service';
import bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionService,
    private readonly usersService: UsersService,
  ) {}
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.phone, dto.password);

    if (!user) throw new UnauthorizedException();

    return this.authService.login(user);
  }

  @Post('signup')
  async signup(@Body() dto: CreateUserDto) {
    const alreadyExits = await this.authService.isAlreadyExits(
      dto.phone,
      dto.email,
    );
    if (alreadyExits)
      return {
        error: 'user already Exits',
        status: 400,
      };

    return this.authService.signup(dto);
  }

  @Post('refresh')
  async refresh(@Body('token') token: string) {
    const payload = this.jwtService.verify<TokenPayload>(token);

    const session = await this.sessionsService.findValidSession(payload.sub);

    if (!session) throw new UnauthorizedException();

    const valid = await bcrypt.compare(token, session.refresh_token_hash);

    if (!valid) {
      await this.sessionsService.deleteAllUserSessions(payload.sub);
      throw new UnauthorizedException('Session compromised');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    await this.sessionsService.deleteSession(session.id);

    return this.authService.login(user);
  }

  @Delete('logout/:sessionId')
  async logout(@Param('sessionId') id: string) {
    await this.sessionsService.deleteSession(id);
    return { message: 'Logged out', statusCode: 200 };
  }

  @Delete('logout-all')
  async logoutAll(@Req() req) {
    await this.sessionsService.deleteAllUserSessions(req.user.id);
  }
}
