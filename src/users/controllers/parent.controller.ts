import { Controller, Post } from '@nestjs/common';
import { ParentsServices } from '../services/parents.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BaseSignupDto } from '../dto/base-signup.dto';


@ApiTags('parents')
@ApiBearerAuth()
@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsServices: ParentsServices) {}
  
//   @ApiOperation({ summary: 'Create New Parent' })
//   @Post()
//   create(@Body() createParentDto: BaseSignupDto)



}
