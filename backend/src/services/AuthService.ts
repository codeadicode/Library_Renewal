import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { IUserRepository } from '../repositories/interfaces';
import { NotificationPreference, SafeUser, User } from '../types';
import { conflict, notFound, unauthorized } from '../lib/errors';

/** Claims carried in the JWT. Only identifiers: profile data is always re-read from the database. */
export interface TokenClaims {
  sub: string;
  studentId: string;
}

const BCRYPT_ROUNDS = 10;
// Compared against when the account does not exist, so a wrong Student ID and a
// wrong password take the same time and return the same error.
const DUMMY_HASH = bcrypt.hashSync('libtrack-timing-equaliser', BCRYPT_ROUNDS);

export class AuthService {
  constructor(private userRepo: IUserRepository) {}

  private sanitize(user: User): SafeUser {
    const { passwordHash: _hash, ...safe } = user;
    return safe;
  }

  private generateToken(user: SafeUser): string {
    const claims: TokenClaims = { sub: user.id, studentId: user.studentId };
    return jwt.sign(claims, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
  }

  public async register(input: {
    studentId: string;
    name: string;
    email: string;
    password: string;
    course: string;
    academicYear: string;
  }): Promise<{ user: SafeUser; token: string }> {
    const studentId = input.studentId.trim();
    const email = input.email.trim().toLowerCase();

    if (await this.userRepo.findByStudentId(studentId)) {
      throw conflict('Student ID is already registered');
    }
    if (await this.userRepo.findByEmail(email)) {
      throw conflict('Email address is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.userRepo.create({
      studentId,
      name: input.name.trim(),
      email,
      passwordHash,
      course: input.course.trim(),
      academicYear: input.academicYear.trim(),
      restricted: false,
      notificationPreference: 'NORMAL',
    });

    const safeUser = this.sanitize(user);
    return { user: safeUser, token: this.generateToken(safeUser) };
  }

  public async login(identifier: string, password: string): Promise<{ user: SafeUser; token: string }> {
    const key = identifier.trim();
    const user = (await this.userRepo.findByStudentId(key)) ?? (await this.userRepo.findByEmail(key));

    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) {
      throw unauthorized('Invalid Student ID / email or password');
    }

    const safeUser = this.sanitize(user);
    return { user: safeUser, token: this.generateToken(safeUser) };
  }

  public verifyToken(token: string): TokenClaims {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded !== 'object' || typeof decoded.sub !== 'string') {
      throw unauthorized('Invalid authentication token');
    }
    return { sub: decoded.sub, studentId: String((decoded as jwt.JwtPayload).studentId ?? '') };
  }

  public async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw notFound('User not found');
    return this.sanitize(user);
  }

  public async updatePreferences(userId: string, pref: NotificationPreference): Promise<SafeUser> {
    const updated = await this.userRepo.update(userId, { notificationPreference: pref });
    return this.sanitize(updated);
  }

  public async updateProfile(
    userId: string,
    patch: { name?: string; email?: string; course?: string; academicYear?: string },
  ): Promise<SafeUser> {
    const clean = { ...patch };
    if (clean.email) {
      clean.email = clean.email.trim().toLowerCase();
      const existing = await this.userRepo.findByEmail(clean.email);
      if (existing && existing.id !== userId) {
        throw conflict('That email is already used by another student.');
      }
    }
    const updated = await this.userRepo.update(userId, clean);
    return this.sanitize(updated);
  }
}
