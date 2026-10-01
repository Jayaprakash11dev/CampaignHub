/*
 * Development seed data. Run with `npm run seed`.
 *
 * WARNING: this deletes all existing users, clients and posts first, so the
 * seed can be re-run at any time. Only use it on a local/dev database.
 * With --if-empty it only seeds when there are no users yet (used by Docker).
 *
 * Every user's password is Password@123.
 */
import {
  Platform,
  PostStatus,
  PrismaClient,
  Role,
  type User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { assertCaptionFits } from '../src/posts/caption-limits';
import { assertTransition } from '../src/posts/post-workflow';
import { assertInFuture, findConflict } from '../src/posts/scheduling';

const prisma = new PrismaClient();

const PASSWORD = 'Password@123';
const HOUR = 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * HOUR;

const { DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED, SCHEDULED, PUBLISHED } =
  PostStatus;

// The status paths a post can have taken to reach its current status.
const PATHS = {
  draft: [DRAFT],
  inReview: [DRAFT, IN_REVIEW],
  changesRequested: [DRAFT, IN_REVIEW, CHANGES_REQUESTED],
  approved: [DRAFT, IN_REVIEW, APPROVED],
  approvedAfterChanges: [
    DRAFT,
    IN_REVIEW,
    CHANGES_REQUESTED,
    IN_REVIEW,
    APPROVED,
  ],
  scheduled: [DRAFT, IN_REVIEW, APPROVED, SCHEDULED],
  published: [DRAFT, IN_REVIEW, APPROVED, SCHEDULED, PUBLISHED],
  publishedAfterChanges: [
    DRAFT,
    IN_REVIEW,
    CHANGES_REQUESTED,
    IN_REVIEW,
    APPROVED,
    SCHEDULED,
    PUBLISHED,
  ],
} satisfies Record<string, PostStatus[]>;

type ClientKey = 'masala' | 'zenith' | 'urbanloom';
type CreatorKey = 'priya' | 'rahul';

interface SeedPost {
  client: ClientKey;
  platform: Platform;
  creator: CreatorKey;
  scheduledAt: Date;
  path: PostStatus[];
  caption: string;
  // Reviewer's comment when requesting changes (10+ characters).
  changeNote?: string;
  // Creator's reply after changes were requested.
  reply?: string;
  // Optional comment left by the reviewer when approving.
  approvalNote?: string;
}

// A wall-clock time in India, `dayOffset` days from today, as a UTC Date.
// e.g. istAt(1, '18:30') = tomorrow 6:30 PM IST.
function istAt(dayOffset: number, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const nowInIst = new Date(Date.now() + IST_OFFSET_MS);
  const utcMidnightOfIstDay = Date.UTC(
    nowInIst.getUTCFullYear(),
    nowInIst.getUTCMonth(),
    nowInIst.getUTCDate() + dayOffset,
    hours,
    minutes,
  );
  return new Date(utcMidnightOfIstDay - IST_OFFSET_MS);
}

const POSTS: SeedPost[] = [
  // --- PUBLISHED (in the past) ---
  {
    client: 'masala',
    platform: Platform.INSTAGRAM,
    creator: 'priya',
    scheduledAt: istAt(-3, '18:30'),
    path: PATHS.published,
    caption:
      'Monsoon is here and so is our Kanda Bhaji Platter 🌧️ Crispy onion fritters, mint chutney and a cutting chai. Tag the friend you would share this with! #MasalaBay #MonsoonCravings',
    approvalNote: 'Lovely copy, approved.',
  },
  {
    client: 'zenith',
    platform: Platform.LINKEDIN,
    creator: 'rahul',
    scheduledAt: istAt(-2, '09:00'),
    path: PATHS.publishedAfterChanges,
    caption:
      'Zenith Fitness is proud to partner with 12 corporate offices in Bengaluru to bring guided morning workouts to their teams. Healthier teams are happier teams. Interested in a workplace wellness programme? Message us.',
    changeNote:
      'Please mention the number of partner offices and add a clear call to action.',
    reply: 'Updated with the office count and a CTA.',
  },
  {
    client: 'urbanloom',
    platform: Platform.FACEBOOK,
    creator: 'priya',
    scheduledAt: istAt(-1, '12:00'),
    path: PATHS.published,
    caption:
      'Our handloom cotton kurtas are back in stock in all sizes. Breathable, hand-woven by artisans in Chanderi, and made to last. Shop the collection at our stores this weekend.',
  },

  // --- SCHEDULED ---
  {
    client: 'zenith',
    platform: Platform.INSTAGRAM,
    creator: 'priya',
    // Goes live a few minutes after seeding, so the publish job can be
    // shown working in a demo.
    scheduledAt: new Date(Date.now() + 3 * 60 * 1000),
    path: PATHS.scheduled,
    caption:
      'New batch alert 💪 Our 6 AM HIIT class at Indiranagar opens tomorrow. First class is free for new members. Link in bio to book your spot.',
  },
  {
    client: 'masala',
    platform: Platform.X,
    creator: 'rahul',
    scheduledAt: istAt(1, '13:00'),
    path: PATHS.scheduled,
    caption:
      'Lunch special today: Hyderabadi dum biryani + raita + gulab jamun for ₹299. Dine-in and delivery till 4 PM. #MasalaBay #BiryaniLovers',
  },
  {
    client: 'urbanloom',
    platform: Platform.INSTAGRAM,
    creator: 'rahul',
    scheduledAt: istAt(2, '19:00'),
    path: PATHS.scheduled,
    caption:
      'Festive edit drop ✨ Block-printed sarees in indigo and madder red, inspired by Bagru. Swipe to see the full collection. #UrbanLoom #Handmade',
  },

  // --- APPROVED ---
  {
    client: 'zenith',
    platform: Platform.FACEBOOK,
    creator: 'rahul',
    scheduledAt: istAt(3, '07:30'),
    path: PATHS.approved,
    caption:
      'Member spotlight: Ananya lost 8 kg in 4 months with our strength + nutrition programme. Read her story and how our coaches built a plan around her night shifts.',
    approvalNote: 'Approved. Ananya has signed the consent form.',
  },
  {
    client: 'masala',
    platform: Platform.LINKEDIN,
    creator: 'priya',
    scheduledAt: istAt(3, '11:00'),
    path: PATHS.approvedAfterChanges,
    caption:
      'Masala Bay Foods is hiring! We are looking for a Kitchen Operations Manager for our new Pune outlet. 5+ years in QSR operations preferred. Apply via the link below.',
    changeNote:
      'Add the experience requirement so we get fewer unqualified applications.',
  },
  {
    client: 'urbanloom',
    platform: Platform.X,
    creator: 'priya',
    scheduledAt: istAt(4, '16:00'),
    path: PATHS.approved,
    caption:
      'Every UrbanLoom piece carries the name of the weaver who made it. Meet the hands behind your favourite kurta 🧵 #WhoMadeMyClothes',
  },

  // --- CHANGES_REQUESTED ---
  {
    client: 'masala',
    platform: Platform.INSTAGRAM,
    creator: 'rahul',
    scheduledAt: istAt(5, '18:00'),
    path: PATHS.changesRequested,
    caption:
      'Try our new paneer tikka pizza!! Best in the city!!! Order now!!!',
    changeNote:
      'Tone is too pushy and "best in the city" is a claim we cannot back up. Please rewrite in our usual warm voice.',
  },
  {
    client: 'zenith',
    platform: Platform.X,
    creator: 'priya',
    scheduledAt: istAt(5, '06:30'),
    path: PATHS.changesRequested,
    caption: 'Lose 10 kg in 30 days with our new bootcamp! Guaranteed results.',
    changeNote:
      'We cannot promise guaranteed weight loss. Please remove the 10 kg claim and focus on the programme itself.',
    reply: 'Good catch, will rework it today.',
  },
  {
    client: 'urbanloom',
    platform: Platform.LINKEDIN,
    creator: 'rahul',
    scheduledAt: istAt(6, '10:00'),
    path: PATHS.changesRequested,
    caption: 'UrbanLoom crossed 50 stores. Thanks everyone.',
    changeNote:
      'Too short for LinkedIn. Add a line about the artisans and the cities we opened in this year.',
  },

  // --- IN_REVIEW ---
  {
    client: 'masala',
    platform: Platform.FACEBOOK,
    creator: 'priya',
    scheduledAt: istAt(6, '12:30'),
    path: PATHS.inReview,
    caption:
      'Sunday thali is back! 14 dishes, unlimited rotis and our famous aamras (while mangoes last). Book a table for the family this weekend.',
  },
  {
    client: 'zenith',
    platform: Platform.LINKEDIN,
    creator: 'priya',
    scheduledAt: istAt(7, '08:00'),
    path: PATHS.inReview,
    caption:
      'Sitting is the new smoking? Our physiotherapist Dr. Kavya Rao shares five desk stretches you can do between meetings. Full guide on our blog.',
  },
  {
    client: 'urbanloom',
    platform: Platform.INSTAGRAM,
    creator: 'priya',
    scheduledAt: istAt(7, '20:00'),
    path: PATHS.inReview,
    caption:
      'Behind the scenes at our Bhuj dye house 🎨 Natural indigo vats that take 10 days to prepare. Slow fashion, literally.',
  },

  // --- DRAFT ---
  {
    client: 'masala',
    platform: Platform.INSTAGRAM,
    creator: 'priya',
    scheduledAt: istAt(8, '18:30'),
    path: PATHS.draft,
    caption:
      'Diwali sweet boxes are here 🪔 Kaju katli, motichoor laddoo and pista barfi, packed in reusable tins. Pre-orders open now.',
  },
  {
    client: 'zenith',
    platform: Platform.INSTAGRAM,
    creator: 'rahul',
    scheduledAt: istAt(9, '07:00'),
    path: PATHS.draft,
    caption:
      'Yoga at sunrise on the terrace, every Saturday this month. Mats provided. Bring a friend!',
  },
  {
    client: 'urbanloom',
    platform: Platform.X,
    creator: 'rahul',
    scheduledAt: istAt(9, '15:00'),
    path: PATHS.draft,
    caption:
      'Sneak peek: our winter pashmina line launches next week. Any guesses on the colours?',
  },
];

// Checks the seed data with the same rule functions the API uses, so we
// never seed a state the app itself could not have produced.
function validate(posts: SeedPost[]) {
  const now = new Date();
  posts.forEach((post, index) => {
    const label = `Seed post #${index + 1}`;
    for (let i = 1; i < post.path.length; i++) {
      assertTransition(post.path[i - 1], post.path[i]);
    }
    assertCaptionFits(post.platform, post.caption);

    const status = post.path[post.path.length - 1];
    if (status === PUBLISHED) {
      if (post.scheduledAt > now) {
        throw new Error(`${label}: published posts must be in the past`);
      }
    } else {
      assertInFuture(post.scheduledAt, now);
    }
    if (post.path.includes(CHANGES_REQUESTED) && !post.changeNote) {
      throw new Error(`${label}: a change request needs a changeNote`);
    }
  });

  const slots = posts.map((post, index) => ({
    id: index + 1,
    clientId: ['masala', 'zenith', 'urbanloom'].indexOf(post.client),
    platform: post.platform,
    scheduledAt: post.scheduledAt,
  }));
  for (const slot of slots) {
    const conflict = findConflict(slot, slots);
    if (conflict) {
      throw new Error(
        `Seed posts #${slot.id} and #${conflict.id} are less than 2 hours apart`,
      );
    }
  }
}

async function main() {
  // Used by the Docker container on start-up: seed a brand-new database,
  // but never wipe one that already has data.
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.log('Database already has data, skipping seed.');
    return;
  }

  validate(POSTS);

  // Children first, because of foreign keys.
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const createUser = (name: string, email: string, role: Role) =>
    prisma.user.create({ data: { name, email, role, passwordHash } });

  await createUser('Aarav Mehta', 'admin@campaignhub.test', Role.ADMIN);
  const creators: Record<CreatorKey, User> = {
    priya: await createUser(
      'Priya Sharma',
      'priya@campaignhub.test',
      Role.CREATOR,
    ),
    rahul: await createUser(
      'Rahul Verma',
      'rahul@campaignhub.test',
      Role.CREATOR,
    ),
  };
  const neha = await createUser(
    'Neha Kapoor',
    'neha@campaignhub.test',
    Role.REVIEWER,
  );
  const arjun = await createUser(
    'Arjun Nair',
    'arjun@campaignhub.test',
    Role.REVIEWER,
  );

  // Each reviewer sees a different set of clients; Zenith has both.
  const reviewersByClient: Record<ClientKey, User[]> = {
    masala: [neha],
    zenith: [neha, arjun],
    urbanloom: [arjun],
  };
  const clientNames: Record<ClientKey, string> = {
    masala: 'Masala Bay Foods',
    zenith: 'Zenith Fitness',
    urbanloom: 'UrbanLoom Apparel',
  };
  const clientIds = {} as Record<ClientKey, number>;
  for (const key of Object.keys(clientNames) as ClientKey[]) {
    const client = await prisma.client.create({
      data: {
        name: clientNames[key],
        reviewers: {
          connect: reviewersByClient[key].map(({ id }) => ({ id })),
        },
      },
    });
    clientIds[key] = client.id;
  }

  const now = Date.now();
  for (const [index, seed] of POSTS.entries()) {
    const creator = creators[seed.creator];
    const clientReviewers = reviewersByClient[seed.client];
    const reviewer = clientReviewers[index % clientReviewers.length];

    // Timestamps for each step of the path, oldest first. Published posts
    // end at their scheduled time; everything else ends a little before now.
    const steps = seed.path.length;
    const lastStepAt =
      seed.path[steps - 1] === PUBLISHED
        ? seed.scheduledAt.getTime()
        : now - (index + 1) * 7 * 60 * 1000;
    const stepTimes = seed.path.map(
      (_, i) => new Date(lastStepAt - (steps - 1 - i) * 4 * HOUR),
    );

    const status = seed.path[steps - 1];
    const post = await prisma.post.create({
      data: {
        clientId: clientIds[seed.client],
        platform: seed.platform,
        caption: seed.caption,
        scheduledAt: seed.scheduledAt,
        status,
        createdById: creator.id,
        // Version 1 at creation, +1 for every status change.
        version: steps,
        createdAt: stepTimes[0],
      },
    });

    for (const [i, toStatus] of seed.path.entries()) {
      const fromStatus = i === 0 ? null : seed.path[i - 1];
      const actorId =
        toStatus === PUBLISHED
          ? null
          : toStatus === APPROVED || toStatus === CHANGES_REQUESTED
            ? reviewer.id
            : creator.id;

      await prisma.auditLog.create({
        data: {
          postId: post.id,
          actorId,
          fromStatus,
          toStatus,
          timestamp: stepTimes[i],
        },
      });

      const comment = (authorId: number, message: string, delayMs = 0) =>
        prisma.comment.create({
          data: {
            postId: post.id,
            authorId,
            message,
            createdAt: new Date(stepTimes[i].getTime() + delayMs),
          },
        });

      if (toStatus === CHANGES_REQUESTED && seed.changeNote) {
        await comment(reviewer.id, seed.changeNote);
        if (seed.reply) {
          await comment(creator.id, seed.reply, 30 * 60 * 1000);
        }
      }
      if (toStatus === APPROVED && seed.approvalNote) {
        await comment(reviewer.id, seed.approvalNote);
      }
    }
  }

  const counts = await prisma.post.groupBy({
    by: ['status'],
    _count: true,
    orderBy: { status: 'asc' },
  });
  console.log('Seeded 5 users, 3 clients and posts per status:');
  for (const row of counts) {
    console.log(`  ${row.status.padEnd(18)} ${row._count}`);
  }
  console.log(`All passwords: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
