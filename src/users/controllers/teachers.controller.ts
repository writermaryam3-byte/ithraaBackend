import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from 'src/common/enums/role.enum';
import { Roles } from '../decorators/role.decorator';
import { TeachersProvider } from '../services/teachers.provider';
import { UsersService } from '../services/users.service';
import { CreateTeacherDto } from '../dto/teachersDtos/create-teacher.dto';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { UpdateTeacherDto } from '../dto/update-teacher.dto';

@ApiTags('teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(
    private readonly teachersServieces: TeachersProvider,
    private readonly usersServices: UsersService,
  ) {}
  @ApiOperation({ summary: 'Created new Teacher' })
  @ApiResponse({ status: 201, description: 'teacher created successfully' })
  @Roles(UserRole.ORGANIZATIONOWNER)
  @Post()
  create(@Body() createTeahcerDto: CreateTeacherDto, @Req() req: AuthRequest) {
    return this.teachersServieces.create(createTeahcerDto, req.user);
  }

  @ApiOperation({ summary: 'Update a class' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
  ) {
    return this.teachersServieces.update(id, updateTeacherDto);
  }

  @ApiOperation({ summary: 'Get all teachers for organization' })
  @Get('organization/:organizationId')
  findAllByOrganization(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ) {
    return this.teachersServieces.findAllByOrganization(organizationId);
  }

  @ApiOperation({ summary: 'Delete a class' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersServices.remove(id);
  }
}
