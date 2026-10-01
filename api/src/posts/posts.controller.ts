import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQuery } from './dto/list-posts.query';
import { TransitionPostDto } from './dto/transition-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@ApiTags('Posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ApiOperation({
    summary: 'List posts',
    description: 'Reviewers only get posts for clients assigned to them.',
  })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListPostsQuery) {
    return this.postsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a post',
    description:
      'Includes `allowedTransitions`: the statuses the current user can move this post to.',
  })
  @ApiResponse({ status: 404, description: 'Not found, or not visible to you' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postsService.getPost(id, user);
  }

  @Get(':id/audit')
  @ApiOperation({
    summary: 'Status history of a post',
    description:
      'Oldest first. `actor` is null for changes made by the system.',
  })
  findAuditLog(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postsService.findAuditLog(id, user);
  }

  @Post()
  @Roles(Role.CREATOR)
  @ApiOperation({ summary: 'Create a post (creators only)' })
  @ApiResponse({
    status: 400,
    description: 'CAPTION_TOO_LONG, SCHEDULED_IN_PAST or VALIDATION_FAILED',
  })
  @ApiResponse({
    status: 409,
    description:
      'SCHEDULE_CONFLICT: another post for the same client and platform is within 2 hours (`conflictingPostId`)',
  })
  create(@Body() dto: CreatePostDto, @CurrentUser() user: AuthUser) {
    return this.postsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.CREATOR)
  @ApiOperation({
    summary: 'Edit a post',
    description:
      'Only the creator, only in DRAFT or CHANGES_REQUESTED. Send the `version` you last loaded.',
  })
  @ApiResponse({ status: 400, description: 'POST_NOT_EDITABLE, ...' })
  @ApiResponse({ status: 403, description: 'Not the creator of the post' })
  @ApiResponse({
    status: 409,
    description:
      'VERSION_MISMATCH (someone else saved first, `currentVersion`) or SCHEDULE_CONFLICT',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postsService.update(id, dto, user);
  }

  // One endpoint for every status change (submit, approve, request
  // changes, schedule). No @Roles here: who may make which change depends
  // on the target status, so post-policy.ts decides.
  @Post(':id/transitions')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Change the status of a post',
    description:
      'Submit (IN_REVIEW), approve, request changes (needs a comment of 10+ characters) or schedule. Every change is written to the audit log.',
  })
  @ApiResponse({
    status: 400,
    description: 'INVALID_TRANSITION, COMMENT_REQUIRED or SCHEDULED_IN_PAST',
  })
  @ApiResponse({
    status: 403,
    description: 'Not allowed for your role (e.g. approving your own post)',
  })
  @ApiResponse({
    status: 409,
    description: 'VERSION_MISMATCH or SCHEDULE_CONFLICT',
  })
  transition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransitionPostDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postsService.transition(id, dto, user);
  }
}
