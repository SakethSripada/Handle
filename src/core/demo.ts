import type { Case } from './model.js';
import { normalizePhone } from './intake.js';

export function demoCommand(text: string) {
    if (!/^demo\s+call\b/i.test(text.trim())) {
        return undefined;
    }

    const match = text.trim().match(/^demo\s+call\s+(\+?[\d ().-]+)$/i);
    const phone = match ? normalizePhone(match[1]) : '';

    return { phone };
}

export function demoDetails(phone: string): Partial<Case> {
    return {
        mode: 'demo',
        title: 'Handle voice demo',
        status: 'ready',
        phone,
        business: 'Demo participant',
        customerName: 'the person demonstrating Handle',
        goal: 'Have a relaxed conversation about MHacks and follow the participant’s interests.',
        context:
            'Open by asking how they have been enjoying MHacks. Listen to their answer and follow their interests with a relevant follow-up. No product pitch or suggested role-play. Keep the conversation brief and end when asked.',
        authorization:
            'A demonstration conversation only. No purchases, cancellations, account changes, email access, or sharing private customer history.',
        memoryExcluded: true,
    };
}

export function callVariables(c: Case) {
    return {
        case_id: c.id,
        secret__case_token: c.callToken,
        customer_name: c.customerName,
        opening_message:
            c.mode === 'demo'
                ? 'Hey, I’m Handle, an AI assistant. How have you been enjoying MHacks so far?'
                : c.customerName.trim()
                  ? `Hi, I’m Handle, an AI assistant calling on behalf of ${c.customerName}.`
                  : 'Hi, I’m Handle, an AI assistant.',
        case_context: JSON.stringify({
            mode: c.mode === 'demo' ? 'demo' : 'task',
            goal: c.goal,
            business: c.business,
            context: c.context,
            authorization: c.authorization,
        }),
    };
}
