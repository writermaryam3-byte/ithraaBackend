import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Roles } from 'src/users/decorators/role.decorator';
import { UserRole } from 'src/common/enums/role.enum';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface';
@ApiTags('grades')
@ApiBearerAuth()
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @ApiOperation({ summary: 'create grade' })
  @Roles(UserRole.ORGANIZATIONOWNER)
  @Post()
  create(@Body() createGradeDto: CreateGradeDto) {
    return this.gradesService.create(createGradeDto);
  }

  @ApiOperation({ summary: 'get all grades' })
  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.gradesService.findAll();
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN, UserRole.TEACHER)
  @Get('organization/:orgId')
  @ApiOperation({ summary: 'Get all grades for a specific org' })
  findAllByOrganization(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: AuthRequest,
  ) {
    return this.gradesService.findAllByOrganization(orgId, req.user);
  }

  @ApiOperation({ summary: 'get one grade' })
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.gradesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateGradeDto: UpdateGradeDto,
  ) {
    return this.gradesService.update(id, updateGradeDto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.gradesService.remove(id);
  }
}
