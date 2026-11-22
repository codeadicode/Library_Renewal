import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'libtrack-super-secret-dev-jwt-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://libtrack:libtrack@localhost:5432/libtrack',
  defaultPolicy: {
    maxRenewals: 2,
    loanPeriodDays: 14,
    renewalPeriodDays: 14,
    upcomingDays: 7,
    approachingMinDays: 4,
    approachingMaxDays: 7,
    urgentMaxDays: 3,
    finePerDay: 5.0,
    weightMetadata: 0.40,
    weightTfidf: 0.35,
    weightCourse: 0.15,
    weightLevel: 0.10,
  },
};

