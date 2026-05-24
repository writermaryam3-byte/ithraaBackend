import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // @Post()
  // create(@Body() createOrganizationDto: CreateOrganizationDto) {
  //   return this.organizationsService.create(createOrganizationDto);
  // }

  @Get()
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get('owner/:ownerId')
  findByOwner(@Param('ownerId', new ParseUUIDPipe()) ownerId: string) {
    return this.organizationsService.findByOwner(ownerId);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.organizationsService.findOne(id);
  }

  @ApiOperation({
    summary: 'edit organization',
  })
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, updateOrganizationDto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.organizationsService.remove(id);
  }
}
