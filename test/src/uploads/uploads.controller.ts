import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/users/decorators/role.decorator';
import { UserRole } from 'src/common/enums/role.enum';
import { Throttle } from '@nestjs/throttler';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function safeExtension(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'application/pdf':
      return '.pdf';
    default:
      return '';
  }
}

@ApiTags('uploads')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.ORGANIZATIONOWNER, UserRole.PARENT)
@Controller('uploads')
export class UploadsController {
  @Post('upload')
  @Throttle({ upload: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter(_req, file, cb) {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          cb(new BadRequestException('Unsupported file type'), false);
          return;
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: './uploads',
        filename(_req, file, cb) {
          const extension = safeExtension(file.mimetype) || extname(file.originalname);
          cb(null, `${randomUUID()}${extension}`);
        },
      }),
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('no file uploaded');
    return {
      message: 'file uploaded successfully',
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
