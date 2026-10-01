import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../auth/auth-user';
import { isPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

// Every query in this service uses this select, so the password hash
// is never sent back to the client.
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: userSelect,
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          role: dto.role,
          passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS),
        },
        select: userSelect,
      });
    } catch (err) {
      if (isPrismaError(err, 'P2002')) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateUserDto, currentUser: AuthUser) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }
    if (id === currentUser.id && dto.role && dto.role !== existing.role) {
      throw new BadRequestException('You cannot change your own role');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    if (dto.role) {
      data.role = dto.role;
      // A user who is no longer a reviewer must not keep access to clients.
      if (dto.role !== Role.REVIEWER) {
        data.reviewingClients = { set: [] };
      }
    }

    return this.prisma.user.update({ where: { id }, data, select: userSelect });
  }

  async remove(id: number, currentUser: AuthUser) {
    if (id === currentUser.id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (err) {
      if (isPrismaError(err, 'P2025')) {
        throw new NotFoundException(`User ${id} not found`);
      }
      if (isPrismaError(err, 'P2003')) {
        throw new ConflictException(
          'User has posts, comments or workflow history and cannot be deleted. Change their role instead.',
        );
      }
      throw err;
    }
  }
}
