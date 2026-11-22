import { MemoryStore, MemoryUserRepository, MemoryBookRepository, MemoryLoanRepository, MemoryReservationRepository, MemoryRenewalAttemptRepository, MemoryAcademicNeedRepository, MemoryNotificationRepository, MemoryFineRepository, MemoryPolicyRepository } from './memoryStore';

// In-memory simulated repository instances preloaded with demo data
export const defaultMemoryStore = new MemoryStore();

export const userRepository = new MemoryUserRepository(defaultMemoryStore);
export const bookRepository = new MemoryBookRepository(defaultMemoryStore);
export const loanRepository = new MemoryLoanRepository(defaultMemoryStore);
export const reservationRepository = new MemoryReservationRepository(defaultMemoryStore);
export const renewalAttemptRepository = new MemoryRenewalAttemptRepository(defaultMemoryStore);
export const academicNeedRepository = new MemoryAcademicNeedRepository(defaultMemoryStore);
export const notificationRepository = new MemoryNotificationRepository(defaultMemoryStore);
export const fineRepository = new MemoryFineRepository(defaultMemoryStore);
export const policyRepository = new MemoryPolicyRepository(defaultMemoryStore);

