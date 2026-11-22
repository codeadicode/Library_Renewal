/**
 * Loads the full LibTrack demonstration dataset into PostgreSQL:
 * policy, topics, courses, the whole book catalogue and its physical copies,
 * the demo students, and their circulation (loans, reservations, renewal
 * history, academic needs, fine ledger and notifications).
 *
 *   npm run db:seed
 *
 * Safe to re-run: catalogue rows are upserted, and the *demo students'*
 * circulation is replaced with a fresh copy dated relative to the current
 * clock (DEMO_NOW if set). Accounts registered through the app are left alone.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  DEMO_PASSWORD,
  buildDemoCirculation,
  demoBooks,
  demoCopies,
  demoCourses,
  demoPolicy,
  demoStudents,
  demoTopics,
} from '../data/demoData';
import { now } from '../lib/clock';

const prisma = new PrismaClient();

async function main() {
  const anchor = now();
  console.log(`[Seed] Seeding LibTrack PostgreSQL database (anchor ${anchor.toISOString()})...`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const circulation = buildDemoCirculation(anchor);
  const demoUserIds = demoStudents.map((s) => s.id);

  await prisma.$transaction(
    async (tx) => {
      // --- Policy -----------------------------------------------------------
      const policyData = { ...demoPolicy, finePerDay: new Prisma.Decimal(demoPolicy.finePerDay.toFixed(2)) };
      await tx.libraryPolicy.upsert({ where: { id: demoPolicy.id }, update: policyData, create: policyData });

      // --- Topics & courses -------------------------------------------------
      for (const t of demoTopics) {
        await tx.topic.upsert({ where: { id: t.id }, update: { name: t.name }, create: t });
      }
      for (const c of demoCourses) {
        await tx.course.upsert({ where: { id: c.id }, update: { code: c.code, name: c.name }, create: c });
      }

      // --- Books, topic/course links, copies --------------------------------
      for (const b of demoBooks) {
        const { topicIds, courseIds, ...book } = b;
        await tx.book.upsert({ where: { id: b.id }, update: book, create: book });
        await tx.bookTopic.deleteMany({ where: { bookId: b.id } });
        await tx.bookCourse.deleteMany({ where: { bookId: b.id } });
        await tx.bookTopic.createMany({ data: topicIds.map((topicId) => ({ bookId: b.id, topicId })) });
        await tx.bookCourse.createMany({ data: courseIds.map((courseId) => ({ bookId: b.id, courseId })) });
      }

      // --- Demo students ----------------------------------------------------
      for (const s of demoStudents) {
        await tx.user.upsert({
          where: { id: s.id },
          update: { ...s, passwordHash },
          create: { ...s, passwordHash },
        });
      }

      // --- Reset demo circulation (children first) ---------------------------
      const demoLoanIds = (await tx.loan.findMany({ where: { userId: { in: demoUserIds } }, select: { id: true } })).map(
        (l) => l.id,
      );
      await tx.scheduledNotification.deleteMany({ where: { userId: { in: demoUserIds } } });
      await tx.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
      await tx.fineLedger.deleteMany({ where: { userId: { in: demoUserIds } } });
      await tx.renewalAttempt.deleteMany({ where: { loanId: { in: demoLoanIds } } });
      await tx.loan.deleteMany({ where: { id: { in: demoLoanIds } } });
      await tx.reservation.deleteMany({ where: { userId: { in: demoUserIds } } });
      await tx.academicNeed.deleteMany({ where: { userId: { in: demoUserIds } } });

      // Copies: status follows the seeded circulation, except copies currently on
      // loan to non-demo (registered) students, which are left untouched.
      const busyCopies = new Set(
        (
          await tx.loan.findMany({ where: { status: 'ACTIVE', userId: { notIn: demoUserIds } }, select: { copyId: true } })
        ).map((l) => l.copyId),
      );
      for (const c of demoCopies) {
        const status = circulation.copyStatus[c.id] ?? 'AVAILABLE';
        await tx.bookCopy.upsert({
          where: { id: c.id },
          update: busyCopies.has(c.id) ? { code: c.code } : { code: c.code, status },
          create: { ...c, status },
        });
      }

      // --- Circulation --------------------------------------------------------
      await tx.loan.createMany({
        data: circulation.loans.map((l) => ({ ...l, status: l.status === 'RETURNED' ? 'RETURNED' : 'ACTIVE' })),
      });
      await tx.reservation.createMany({ data: circulation.reservations });
      await tx.renewalAttempt.createMany({ data: circulation.renewalAttempts });
      await tx.academicNeed.createMany({ data: circulation.academicNeeds });
      await tx.fineLedger.createMany({
        data: circulation.fines.map((f) => ({ ...f, amount: new Prisma.Decimal(f.amount.toFixed(2)) })),
      });
      await tx.notification.createMany({ data: circulation.notifications });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  const counts = await Promise.all([
    prisma.book.count(),
    prisma.bookCopy.count(),
    prisma.user.count(),
    prisma.loan.count(),
    prisma.reservation.count(),
    prisma.fineLedger.count(),
  ]);
  console.log(
    `[Seed] Done: ${counts[0]} books, ${counts[1]} copies, ${counts[2]} users, ${counts[3]} loans, ` +
      `${counts[4]} reservations, ${counts[5]} fine entries. Demo password: ${DEMO_PASSWORD}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
