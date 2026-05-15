import {
  Controller,
  Get,
  Body,
  Param,
  Delete,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserRole } from 'src/common/enums/role.enum';
import { TeachersProvider } from '../services/teachers.provider';
import { Roles } from '../decorators/role.decorator';
import { UsersService } from '../services/users.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly teachersProvider: TeachersProvider,
  ) {}

  // @Post()
  // create(@Body() createUserDto: CreateUserDto) {
  //   return this.usersService.create(createUserDto);
  // }

  @Roles(UserRole.ADMIN)
  @Post('seed-roles')
  seedRoles() {
    return this.usersService.seedRoles();
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Get('roles')
  findUsersByRoles() {
    return this.usersService.findUsersByRoles();
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get('organization-owner/:id')
  getOrganizationOwner(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getOrganizationOwner(id);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.findById(id);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.remove(id);
  }

  // @Post('teachers')
  // createTeacher(@Body() createTeacherDto: CreateTeacherDto) {
  //   return this.teachersProvider.create(createTeacherDto);
  // }
}
