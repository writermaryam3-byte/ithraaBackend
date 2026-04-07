import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/common/enums/role.enum';
import { AuthRequest } from 'src/common/interfaces/auth-request.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.get<UserRole[]>('roles', context.getHandler());

    if (!roles) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;
    console.log(user);
    if (!user) return false; // مهم جدا
    console.log(
      user.roles.some((role) => {
        console.log('user role', `"${role.name}"`);
        console.log('wanted roles', roles);
        return roles.includes(role.name);
      }),
    );
    return user.roles.some((role) => roles.includes(role.name));
  }
}
