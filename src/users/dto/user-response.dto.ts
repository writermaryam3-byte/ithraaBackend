import { UserRole } from 'src/common/enums/role.enum';

export interface IUserResponseDto {
  id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  phone: string;
  isPhoneVerified: boolean;
  role: UserRole[];
}
