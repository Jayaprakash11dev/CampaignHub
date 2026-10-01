import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { isPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const clientSelect = {
  id: true,
  name: true,
  createdAt: true,
  reviewers: {
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  },
  _count: { select: { posts: true } },
} satisfies Prisma.ClientSelect;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: AuthUser) {
    return this.prisma.client.findMany({
      where: this.visibleTo(user),
      select: clientSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    // A reviewer asking for a client they aren't assigned to gets the same
    // 404 as for a client that doesn't exist.
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.visibleTo(user) },
      select: clientSelect,
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  async create(dto: CreateClientDto) {
    await this.assertNameIsFree(dto.name);
    try {
      return await this.prisma.client.create({
        data: { name: dto.name },
        select: clientSelect,
      });
    } catch (err) {
      if (isPrismaError(err, 'P2002')) {
        throw new ConflictException('Client name already exists');
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateClientDto) {
    if (dto.name) {
      await this.assertNameIsFree(dto.name, id);
    }
    try {
      return await this.prisma.client.update({
        where: { id },
        data: { name: dto.name },
        select: clientSelect,
      });
    } catch (err) {
      if (isPrismaError(err, 'P2025')) {
        throw new NotFoundException(`Client ${id} not found`);
      }
      if (isPrismaError(err, 'P2002')) {
        throw new ConflictException('Client name already exists');
      }
      throw err;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.client.delete({ where: { id } });
    } catch (err) {
      if (isPrismaError(err, 'P2025')) {
        throw new NotFoundException(`Client ${id} not found`);
      }
      if (isPrismaError(err, 'P2003')) {
        throw new ConflictException('Client has posts and cannot be deleted');
      }
      throw err;
    }
  }

  async setReviewers(id: number, reviewerIds: number[]) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    const reviewers = await this.prisma.user.findMany({
      where: { id: { in: reviewerIds }, role: Role.REVIEWER },
      select: { id: true },
    });
    const validIds = new Set(reviewers.map((r) => r.id));
    const invalidIds = reviewerIds.filter((rid) => !validIds.has(rid));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `These users don't exist or are not reviewers: ${invalidIds.join(', ')}`,
      );
    }

    // `set` replaces the whole list, so calling this twice with the same
    // ids gives the same result.
    return this.prisma.client.update({
      where: { id },
      data: { reviewers: { set: reviewerIds.map((rid) => ({ id: rid })) } },
      select: clientSelect,
    });
  }

  // The database's unique index is case-sensitive, so "Acme" and "acme"
  // would both be allowed. Check case-insensitively first. (The unique
  // index still catches exact duplicates created at the same moment.)
  private async assertNameIsFree(name: string, exceptId?: number) {
    const existing = await this.prisma.client.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        id: exceptId ? { not: exceptId } : undefined,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Client name already exists');
    }
  }

  // Reviewers only see clients assigned to them. Admins and creators see
  // all clients (a creator can write posts for any client).
  private visibleTo(user: AuthUser): Prisma.ClientWhereInput {
    if (user.role === Role.REVIEWER) {
      return { reviewers: { some: { id: user.id } } };
    }
    return {};
  }
}
