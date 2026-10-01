import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService],
  // Exported so other modules (comments) can reuse findOne's visibility check.
  exports: [PostsService],
})
export class PostsModule {}
