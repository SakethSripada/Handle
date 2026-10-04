import type { Config } from '../config.js';
import type { Store } from './store.js';
import type { CaseEvent } from './model.js';
import { jsonRequest } from '../providers/http.js';

interface SQLResult {
    rows: [string, string][];
}

export async function auditStorage(config: Config, store: Store) {
    const counts = [];

    for (const [table, records] of [
        ['case_state', store.cases().map(({ callToken: _, ...c }) => c)],
        ['case_event', store.list<CaseEvent>('event')],
    ] as const) {
        const result = await jsonRequest<SQLResult[]>(
            'SpacetimeDB',
            `${config.SPACETIMEDB_URL}/v1/database/${config.SPACETIMEDB_DATABASE}/sql`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.SPACETIMEDB_TOKEN}`,
                },
                body: `SELECT id, data FROM ${table}`,
            },
        );
        const cloud = new Map(result.flatMap((r) => r.rows));
        let matched = 0;
        let missing = 0;
        let different = 0;

        for (const record of records) {
            const value = cloud.get(record.id);

            if (!value) {
                missing++;
            } else if (value === JSON.stringify(record)) {
                matched++;
            } else {
                different++;
            }
        }

        counts.push({
            table,
            local: records.length,
            cloud: cloud.size,
            matched,
            missing,
            different,
        });
    }

    return {
        checkedAt: Date.now(),
        consistent: counts.every((c) => c.missing === 0 && c.different === 0),
        counts,
    };
}
