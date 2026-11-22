import { z } from 'zod';

export const registerSchema = z.object({
  studentId: z.string().min(3).max(30),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  course: z.string().min(2),
  academicYear: z.string().min(1),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Student ID or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const decisionSchema = z.object({
  decision: z.enum(['STILL_NEED', 'DONE', 'NOT_SURE']),
});

export const preferenceSchema = z.object({
  notificationPreference: z.enum(['DIGEST', 'IMPORTANT', 'NORMAL', 'QUIET']),
});

export const academicNeedSchema = z.object({
  course: z.string().min(1),
  topic: z.string().min(1),
  assessmentType: z.enum(['EXAM', 'ASSIGNMENT', 'PROJECT', 'INTERNAL', 'OTHER']).default('INTERNAL'),
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)'),
  neededUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)'),
});

export const academicNeedPatchSchema = academicNeedSchema.partial();

