import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { IUserRepository } from '../repositories/interfaces';
import { SafeUser, User } from '../types';

export class AuthService {
  constructor(private userRepo: IUserRepository) {}

  private sanitize(user: User): SafeUser {
    const { passwordHash: _hash, ...safe } = user;
    return safe;
  }

  private generateToken(user: SafeUser): string {
    return jwt.sign(user, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as any);
  }

  public async register(input: {
    studentId: string;
    name: string;
    email: string;
    password: string;
    course: string;
    academicYear: string;
  }): Promise<{ user: SafeUser; token: string }> {
    const existingStudentId = await this.userRepo.findByStudentId(input.studentId);
    if (existingStudentId) {
      const err = new Error('Student ID is already registered');
      (err as any).statusCode = 409;
      throw err;
    }

    const existingEmail = await this.userRepo.findByEmail(input.email);
    if (existingEmail) {
      const err = new Error('Email address is already registered');
      (err as any).statusCode = 409;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await this.userRepo.create({
      studentId: input.studentId.trim(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash,
      course: input.course.trim(),
      academicYear: input.academicYear.trim(),
      restricted: false,
      notificationPreference: 'NORMAL',
    });

    const safeUser = this.sanitize(user);
    const token = this.generateToken(safeUser);
    return { user: safeUser, token };
  }

  public async login(
    identifier: string,
    password: string,
  ): Promise<{ user: SafeUser; token: string }> {
    const key = identifier.trim();
    let user = await this.userRepo.findByStudentId(key);
    if (!user) {
      user = await this.userRepo.findByEmail(key);
    }

    if (!user) {
      const err = new Error('Invalid Student ID / email or password');
      (err as any).statusCode = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const err = new Error('Invalid Student ID / email or password');
      (err as any).statusCode = 401;
      throw err;
    }

    const safeUser = this.sanitize(user);
    const token = this.generateToken(safeUser);
    return { user: safeUser, token };
  }

  public async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      (err as any).statusCode = 404;
      throw err;
    }
    return this.sanitize(user);
  }

  public async updatePreferences(
    userId: string,
    pref: 'DIGEST' | 'IMPORTANT' | 'NORMAL' | 'QUIET',
  ): Promise<SafeUser> {
    const updated = await this.userRepo.update(userId, { notificationPreference: pref });
    return this.sanitize(updated);
  }
}

