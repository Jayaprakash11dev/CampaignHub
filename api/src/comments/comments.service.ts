import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PostsService } from '../posts/posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

const commentInclude = {
  author: { select: { id: true, name: true, role: true } },
} satisfies Prisma.CommentInclude;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
  ) {}

  async list(postId: number, user: AuthUser) {
    // Reuses the posts visibility rule: a reviewer who can't see the post
    // gets a 404 here too.
    await this.postsService.findOne(postId, user);

    return this.prisma.comment.findMany({
      where: { postId },
      include: commentInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async create(postId: number, dto: CreateCommentDto, user: AuthUser) {
    await this.postsService.findOne(postId, user);

    // Comments are a discussion about the post, not a change to it, so
    // they don't bump the post's version.
    return this.prisma.comment.create({
      data: { postId, authorId: user.id, message: dto.message },
      include: commentInclude,
    });
  }
}
