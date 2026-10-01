import { Module } from '@nestjs/common';
import { PublishScheduledPostsJob } from './publish-scheduled-posts.job';

@Module({
  providers: [PublishScheduledPostsJob],
})
export class SchedulerModule {}
