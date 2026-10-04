import type { Case } from './model.js';
import type { Store } from './store.js';

export interface CallMemory {
    caseId: string;
    business: string;
    completedAt: number;
    outcome: string;
    confirmation: string;
}

const retention = 90 * 24 * 60 * 60 * 1000;

// Retrieve evidence, not standing authority. Matching a phone alone is not enough:
// a shared call center can handle unrelated businesses.
export function recallCalls(
    store: Store,
    current: Case,
    now = Date.now(),
): CallMemory[] {
    if (!current.business.trim() || !current.phone) {
        return [];
    }

    return store
        .cases()
        .filter(
            (c) =>
                c.id !== current.id &&
                c.owner === current.owner &&
                c.mode !== 'rehearsal' &&
                c.status === 'resolved' &&
                !c.memoryExcluded &&
                c.confirmedAt &&
                c.confirmedAt >= now - retention &&
                c.confirmation &&
                c.outcome &&
                c.phone === current.phone &&
                c.business.trim().toLowerCase() ===
                    current.business.trim().toLowerCase(),
        )
        .sort((a, b) => b.confirmedAt! - a.confirmedAt!)
        .slice(0, 3)
        .map((c) => ({
            caseId: c.id,
            business: c.business,
            completedAt: c.confirmedAt!,
            outcome: c.outcome!,
            confirmation: c.confirmation!,
        }));
}
