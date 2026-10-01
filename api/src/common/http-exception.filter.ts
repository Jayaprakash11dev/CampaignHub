import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Every error response from the API has this shape, so the frontend can
// always switch on `code` instead of parsing message text:
//
//   {
//     statusCode: 409,
//     error: 'Conflict',
//     code: 'SCHEDULE_CONFLICT',
//     message: 'Post #12 for this client on INSTAGRAM is scheduled within ...',
//     conflictingPostId: 12,          // extra fields depend on the error
//     details: [...],                 // only for validation errors
//     path: '/api/posts',
//     timestamp: '2026-10-01T04:00:00.000Z'
//   }
export interface ErrorBody {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: string[];
  path: string;
  timestamp: string;
  [extra: string]: unknown;
}

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
};

const STATUS_TEXT: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const body = this.toErrorBody(exception, request.url);
    response.status(body.statusCode).json(body);
  }

  toErrorBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();

    if (!(exception instanceof HttpException)) {
      // Unexpected errors (bugs, database down, ...): log the details for
      // us, but don't send internals to the client.
      this.logger.error(exception);
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
        path,
        timestamp,
      };
    }

    const statusCode = exception.getStatus();
    const raw = exception.getResponse();
    // Nest exceptions carry either a plain string or an object; our own
    // errors pass an object with `code` and extra fields.
    const fields: Record<string, unknown> =
      typeof raw === 'string' ? { message: raw } : { ...raw };

    // ValidationPipe puts a list of messages in `message`.
    let details: string[] | undefined;
    if (Array.isArray(fields.message)) {
      details = fields.message as string[];
      fields.message = details[0];
      fields.code ??= 'VALIDATION_FAILED';
    }

    return {
      ...fields,
      statusCode,
      // Some exceptions (e.g. passport's 401) don't set `error`.
      error:
        (fields.error as string) ?? STATUS_TEXT[statusCode] ?? exception.name,
      code: (fields.code as string) ?? CODE_BY_STATUS[statusCode] ?? 'ERROR',
      message: (fields.message as string) ?? exception.message,
      ...(details ? { details } : {}),
      path,
      timestamp,
    };
  }
}
