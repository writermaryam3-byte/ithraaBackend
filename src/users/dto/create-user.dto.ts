import { IsEmail, IsEnum, IsString } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  name;

  @IsEmail()
  email;

  @IsString()
  password;

  @IsString()
  phone;

  @IsEnum(Role)
  role;
}
