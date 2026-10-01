import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  const toBody = (err: unknown) => filter.toErrorBody(err, '/api/test');

  it('keeps our own error code and extra fields', () => {
    const body = toBody(
      new ConflictException({
        code: 'SCHEDULE_CONFLICT',
        message: 'Post #12 is too close',
        conflictingPostId: 12,
      }),
    );

    expect(body).toMatchObject({
      statusCode: 409,
      code: 'SCHEDULE_CONFLICT',
      message: 'Post #12 is too close',
      conflictingPostId: 12,
      path: '/api/test',
    });
  });

  it('turns ValidationPipe message lists into VALIDATION_FAILED + details', () => {
    const body = toBody(
      new BadRequestException([
        'version must be an integer number',
        'property status should not exist',
      ]),
    );

    expect(body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'version must be an integer number',
      details: [
        'version must be an integer number',
        'property status should not exist',
      ],
    });
  });

  it.each([
    [new UnauthorizedException(), 401, 'UNAUTHORIZED'],
    [new ForbiddenException('Nope'), 403, 'FORBIDDEN'],
    [new NotFoundException('Post 9 not found'), 404, 'NOT_FOUND'],
    [new BadRequestException('Bad'), 400, 'BAD_REQUEST'],
  ])('gives a plain %s a code from its status', (err, status, code) => {
    expect(toBody(err)).toMatchObject({ statusCode: status, code });
  });

  it('uses the HTTP status text when the exception has no `error` field', () => {
    // Passport throws a 401 whose body is just { message, statusCode }.
    const passportStyle = new UnauthorizedException({
      message: 'Unauthorized',
      statusCode: 401,
    });
    expect(toBody(passportStyle).error).toBe('Unauthorized');
  });

  it('keeps the message of a plain exception', () => {
    expect(toBody(new NotFoundException('Post 9 not found')).message).toBe(
      'Post 9 not found',
    );
  });

  it('hides the details of unexpected errors behind a 500', () => {
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);

    const body = toBody(new Error('connection refused at 10.0.0.5'));

    expect(body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });
});
