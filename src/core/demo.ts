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
        goal: 'Have a short, natural conversation with the demo participant.',
        context:
            'Introduce Handle, answer questions, and offer a fictional customer-service role-play if requested. Ask whether this is a good time. Keep the demo brief and end when asked.',
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
                ? 'Hi, I’m Handle, an AI assistant. You were invited to try a quick live demo. Is now a good time to chat?'
                : `Hi, this is Handle, an AI assistant calling on behalf of ${c.customerName}. I’m hoping you can help with a customer-service request.`,
        case_context: JSON.stringify({
            mode: c.mode === 'demo' ? 'demo' : 'customer_service',
            goal: c.goal,
            business: c.business,
            context: c.context,
            authorization: c.authorization,
        }),
    };
}
