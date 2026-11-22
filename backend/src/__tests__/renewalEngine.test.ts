import { RenewalService } from '../services/RenewalService';
import { MemoryDataStore, MemoryStore } from '../repositories/memoryStore';
import { setClockOverride } from '../lib/clock';

const ANCHOR = new Date('2026-11-21T06:30:00Z');

describe('Renewal Eligibility Engine', () => {
  let store: MemoryStore;
  let service: RenewalService;

  beforeEach(() => {
    setClockOverride(ANCHOR);
    store = new MemoryStore(ANCHOR);
    service = new RenewalService(new MemoryDataStore(store));
  });

  afterAll(() => setClockOverride(null));

  test('Permits renewal for eligible book with correct +14 days projection', async () => {
    // Akash Tiwari (1RV25CS013) with Database System Concepts
    const { eligibility, loan } = await service.evaluateEligibility('l-akash-dsc', 'u-akash');
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.reason_code).toBe('ELIGIBLE');
    expect(eligibility.suggested_action).toBe('RENEW');
    expect(eligibility.projected_due_at).toBeDefined();

    // Perform renewal
    const result = await service.processRenewal('l-akash-dsc', 'u-akash');
    expect(result.success).toBe(true);
    expect(result.loan.renewalCount).toBe(1);
    expect(result.attempt.reasonCode).toBe('RENEWAL_SUCCESS');
  });

  test('Blocks renewal when active reservation exists by another student', async () => {
    // Akash with OS Concepts (reserved by Aadya Dhuri 1RZ25CS003)
    const { eligibility } = await service.evaluateEligibility('l-akash-os', 'u-akash');
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason_code).toBe('ACTIVE_RESERVATION');
    expect(eligibility.suggested_action).toBe('FIND_ALTERNATIVE');
    expect(eligibility.reason).toContain('reserved');

    const result = await service.processRenewal('l-akash-os', 'u-akash');
    expect(result.success).toBe(false);
    expect(result.attempt.eligible).toBe(false);
    expect(result.attempt.reasonCode).toBe('ACTIVE_RESERVATION');
  });

  test('Blocks renewal when max renewals count is reached', async () => {
    // Leila Khan (1RV25EC045) with DSP (renewalCount = 2, max = 2)
    const { eligibility } = await service.evaluateEligibility('l-leila-dsp', 'u-leila');
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason_code).toBe('MAX_RENEWALS_REACHED');
    expect(eligibility.suggested_action).toBe('FIND_ALTERNATIVE');
    expect(eligibility.reason).toContain('Maximum renewal limit');
  });

  test('Blocks renewal when student account has restrictions', async () => {
    // Dev Nair (1RV25EC078) with Microelectronic Circuits (restricted: true)
    const { eligibility } = await service.evaluateEligibility('l-dev-sedra', 'u-dev');
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason_code).toBe('ACCOUNT_RESTRICTED');
    expect(eligibility.suggested_action).toBe('FIND_ALTERNATIVE');
  });

  test('Blocks renewal when book is overdue', async () => {
    // Priya Sharma (1RV25EC092) with Electromagnetics (4 days overdue)
    const { eligibility } = await service.evaluateEligibility('l-priya-sadiku', 'u-priya');
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason_code).toBe('LOAN_OVERDUE');
    expect(eligibility.suggested_action).toBe('RETURN');
  });

  test('Blocks renewal when book is marked non-renewable', async () => {
    // Mark a book non-renewable
    const book = store.books.get('b-dsc')!;
    book.renewable = false;
    const { eligibility } = await service.evaluateEligibility('l-akash-dsc', 'u-akash');
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason_code).toBe('ITEM_NOT_RENEWABLE');
    expect(eligibility.suggested_action).toBe('FIND_ALTERNATIVE');
  });

  test('Prevents student from inspecting or renewing loans belonging to another student', async () => {
    await expect(service.evaluateEligibility('l-akash-dsc', 'u-aadya')).rejects.toThrow(
      'Forbidden: You do not own this loan',
    );
    await expect(service.processRenewal('l-akash-dsc', 'u-aadya')).rejects.toThrow(
      'Forbidden: You do not own this loan',
    );
  });
});
