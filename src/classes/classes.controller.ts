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
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { Roles } from 'src/users/decorators/role.decorator';
import { UserRole } from 'src/common/enums/role.enum';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface';

@ApiTags('classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @ApiOperation({ summary: 'Create new class' })
  @ApiResponse({ status: 201, description: 'class created successfully' })
  @Roles(UserRole.ORGANIZATIONOWNER)
  @Post()
  create(@Body() createClassDto: CreateClassDto, @Req() req: AuthRequest) {
    return this.classesService.create(createClassDto, req.user);
  }

  @ApiOperation({ summary: 'Get all classes' })
  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.classesService.findAll();
  }

  @ApiOperation({ summary: 'Get all CLASSES in ORG' })
  @Get('organization/:orgId')
  findClassesByOrg(@Param('orgId', new ParseUUIDPipe()) orgId: string) {
    return this.classesService.findClassesByOrg(orgId);
  }

  @ApiOperation({ summary: 'Get all children in class' })
  @Get(':id/get-children')
  getChildrenInClass(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.classesService.getChildrenInClass(id);
  }

  @ApiOperation({ summary: 'Get one class' })
  @Roles(UserRole.ADMIN, UserRole.ORGANIZATIONOWNER)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.classesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a class' })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateClassDto: UpdateClassDto,
  ) {
    return this.classesService.update(id, updateClassDto);
  }

  @ApiOperation({ summary: 'Delete a class' })
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.classesService.remove(id);
  }

  @ApiOperation({ summary: 'asign child to class' })
  @Post(':clsId/asign/:childId')
  asignChild(
    @Param('childId', new ParseUUIDPipe()) childId: string,
    @Param('clsId', new ParseUUIDPipe()) clsId: string,
  ) {
    return this.classesService.asignChild(childId, clsId);
  }
}
