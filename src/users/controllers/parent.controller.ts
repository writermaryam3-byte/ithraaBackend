import { Controller } from '@nestjs/common';
import { ParentsServices } from '../services/parents.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('parents')
@ApiBearerAuth()
@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsServices: ParentsServices) {}

  //   @ApiOperation({ summary: 'Create New Parent' })
  //   @Post()
  //   create(@Body() createParentDto: BaseSignupDto)
}
