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
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQuery } from './dto/list-posts.query';
import { TransitionPostDto } from './dto/transition-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListPostsQuery) {
    return this.postsService.findAll(user, query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postsService.getPost(id, user);
  }

  @Get(':id/audit')
  findAuditLog(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postsService.findAuditLog(id, user);
  }

  @Post()
  @Roles(Role.CREATOR)
  create(@Body() dto: CreatePostDto, @CurrentUser() user: AuthUser) {
    return this.postsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.CREATOR)
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
  transition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransitionPostDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.postsService.transition(id, dto, user);
  }
}
