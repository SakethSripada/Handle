export function stopCommand(text: string): 'current' | 'all' | undefined {
    const command = text
        .trim()
        .replace(/[.!?]+$/, '')
        .trim();

    if (
        /^(?:please\s+)?(?:stop|end|cancel|hang up)\s+all\s+(?:my\s+)?calls(?:\s+now)?$/i.test(
            command,
        )
    ) {
        return 'all';
    }

    if (
        /^(?:please\s+)?(?:(?:stop|end|cancel)(?:\s+(?:the|this|my|current))?\s+call|hang\s*up(?:\s+(?:the|this|my|current)?\s*call)?|stop|cancel request)(?:\s+now)?$/i.test(
            command,
        )
    ) {
        return 'current';
    }

    return undefined;
}
