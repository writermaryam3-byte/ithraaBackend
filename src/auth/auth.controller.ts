import {
  BadRequestException,
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
import { JwtService } from '@nestjs/jwt';
import { SessionService } from 'src/session/session.service';
import bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { BeneficiariesSignupDto } from './dto/beneficiaries/beneficiaries-signup.dto';
import { EnrichersSignupDto } from './dto/enrichers/enrichers-signup.dto';
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

  @Post('beneficiaries-signup')
  async beneficiariesSiginup(@Body() dto: BeneficiariesSignupDto) {
    const alreadyExists = await this.authService.isAlreadyExits(
      dto.phone,
      dto.email,
    );
    if (alreadyExists) {
      throw new BadRequestException('User already exists');
    }
    return this.authService.beneficiariesSignup(dto);
  }

  @Post('enrichers-signup')
  async enrichersSignup(@Body() dto: EnrichersSignupDto) {
    const alreadyExists = await this.authService.isAlreadyExits(
      dto.phone,
      dto.email,
    );
    if (alreadyExists) {
      throw new BadRequestException('User already exists');
    }
    return this.authService.enrichersSignup(dto);
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
