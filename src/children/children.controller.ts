import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ChildrenService } from './children.service';
import { CreateChildWithParentDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { UserRole } from 'src/common/enums/role.enum';
import { Roles } from 'src/users/decorators/role.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';

@ApiTags('children')
@ApiBearerAuth()
@Controller('children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.PARENT, UserRole.TEACHER)
  @Post()
  @ApiOperation({
    summary:
      'add child with auto parent account creation (organization members)',
  })
  create(
    @Body()
    createChildWithParentDto: CreateChildWithParentDto,
    @Req()
    req: AuthRequest,
  ) {
    return this.childrenService.create(createChildWithParentDto, req.user);
  }

  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all children (admin)' })
  @Get('all')
  findAll() {
    return this.childrenService.findAll();
  }

  @Get()
  @ApiOperation({ summary: 'Get all children for specific user' })
  findByUser(@Query('userId', new ParseUUIDPipe()) userId: string) {
    return this.childrenService.findByUser(userId);
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN, UserRole.TEACHER)
  @Get('organization/:orgId')
  @ApiOperation({ summary: 'Get all children for specific org' })
  findAllByOrganization(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: AuthRequest,
  ) {
    return this.childrenService.findAllByOrganization(orgId, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get child data' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.childrenService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update child' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateChildDto: UpdateChildDto,
  ) {
    return this.childrenService.update(id, updateChildDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete child' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.childrenService.remove(id);
  }
}
