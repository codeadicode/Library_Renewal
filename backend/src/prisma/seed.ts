import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Seeding LibTrack PostgreSQL Database...');

  // 1. Seed Policy
  const policy = await prisma.libraryPolicy.upsert({
    where: { id: 'policy-default' },
    update: {},
    create: {
      id: 'policy-default',
      name: 'Standard Academic Borrowing Policy',
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
      isDefault: true,
    },
  });
  console.log(`[Seed] Seeded policy: ${policy.name}`);

  // 2. Seed Topics
  const topicNames = [
    { id: 't-norm', name: 'Database Normalisation' },
    { id: 't-sql', name: 'SQL' },
    { id: 't-ra', name: 'Relational Algebra' },
    { id: 't-tx', name: 'Transactions' },
    { id: 't-proc', name: 'Process Management' },
    { id: 't-mem', name: 'Memory Management' },
    { id: 't-fs', name: 'File Systems' },
    { id: 't-tcp', name: 'TCP/IP' },
    { id: 't-route', name: 'Routing' },
    { id: 't-sort', name: 'Sorting' },
    { id: 't-graph', name: 'Graph Algorithms' },
    { id: 't-dp', name: 'Dynamic Programming' },
    { id: 't-logic', name: 'Propositional Logic' },
    { id: 't-comb', name: 'Combinatorics' },
    { id: 't-arch', name: 'Instruction Set Architecture' },
    { id: 't-pipe', name: 'Pipelining' },
    { id: 't-search', name: 'Search' },
    { id: 't-ml', name: 'Supervised Learning' },
    { id: 't-nn', name: 'Neural Networks' },
    { id: 't-sec', name: 'Cryptography' },
    { id: 't-se', name: 'Requirements Engineering' },
    { id: 't-oo', name: 'Object-Oriented Design' },
    { id: 't-compile', name: 'Parsing' },
    { id: 't-lin', name: 'Linear Algebra' },
    { id: 't-prob', name: 'Probability' },
  ];

  for (const t of topicNames) {
    await prisma.topic.upsert({
      where: { id: t.id },
      update: {},
      create: t,
    });
  }

  // 3. Seed Courses
  const courses = [
    { id: 'c-dbms', code: 'CS301', name: 'Database Management Systems' },
    { id: 'c-os', code: 'CS302', name: 'Operating Systems' },
    { id: 'c-net', code: 'CS303', name: 'Computer Networks' },
    { id: 'c-dsa', code: 'CS201', name: 'Data Structures and Algorithms' },
    { id: 'c-dm', code: 'CS202', name: 'Discrete Mathematics' },
    { id: 'c-coa', code: 'CS204', name: 'Computer Organisation' },
    { id: 'c-ai', code: 'CS401', name: 'Artificial Intelligence' },
    { id: 'c-ml', code: 'CS402', name: 'Machine Learning' },
    { id: 'c-se', code: 'CS305', name: 'Software Engineering' },
    { id: 'c-sec', code: 'CS404', name: 'Computer Security' },
    // Core ECE Courses
    { id: 'c-ss', code: 'EC201', name: 'Signals and Systems' },
    { id: 'c-ac', code: 'EC202', name: 'Analog Electronic Circuits' },
    { id: 'c-comm', code: 'EC301', name: 'Digital Communication Systems' },
    { id: 'c-lic', code: 'EC302', name: 'Linear Integrated Circuits' },
    { id: 'c-dsp', code: 'EC303', name: 'Digital Signal Processing' },
    { id: 'c-vlsi', code: 'EC401', name: 'CMOS VLSI Design' },
    { id: 'c-em', code: 'EC204', name: 'Electromagnetic Waves' },
  ];

  for (const c of courses) {
    await prisma.course.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }

  // 4. Seed Demo Students (password: demo1234)
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('demo1234', salt);

  const students = [
    {
      id: 'u-akash',
      studentId: '1RV25CS013',
      name: 'Akash Dhuri',
      email: 'akash@campus.demo',
      passwordHash,
      course: 'B.Tech Computer Science & Engineering',
      academicYear: 'Year 3',
      restricted: false,
    },
    {
      id: 'u-aadya',
      studentId: '1RZ25CS003',
      name: 'Aadya Tiwari',
      email: 'aadya@campus.demo',
      passwordHash,
      course: 'B.Tech Computer Science & Engineering',
      academicYear: 'Year 2',
      restricted: false,
    },
    {
      id: 'u-leila',
      studentId: '1RV25EC045',
      name: 'Leila Khan',
      email: 'leila@campus.demo',
      passwordHash,
      course: 'B.Tech Electronics & Communication Engineering',
      academicYear: 'Year 3',
      restricted: false,
    },
    {
      id: 'u-dev',
      studentId: '1RV25EC078',
      name: 'Dev Nair',
      email: 'dev@campus.demo',
      passwordHash,
      course: 'B.Tech Electronics & Communication Engineering',
      academicYear: 'Year 4',
      restricted: true,
    },
    {
      id: 'u-priya',
      studentId: '1RV25EC092',
      name: 'Priya Sharma',
      email: 'priya@campus.demo',
      passwordHash,
      course: 'B.Tech Electronics & Communication Engineering',
      academicYear: 'Year 2',
      restricted: false,
    },
  ];

  for (const s of students) {
    await prisma.user.upsert({
      where: { id: s.id },
      update: {},
      create: s,
    });
  }
  console.log(`[Seed] Seeded ${students.length} demo students.`);

  console.log('[Seed] Database seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

