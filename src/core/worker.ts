/** Run one job at a time without allowing a slow provider to block other workers. */
export function startWorker(
    name: string,
    interval: number,
    run: () => Promise<void>,
) {
    let busy = false;
    const timer = setInterval(async () => {
        if (busy) {
            return;
        }

        busy = true;

        try {
            await run();
        } catch {
            console.warn(`${name} worker will retry.`);
        } finally {
            busy = false;
        }
    }, interval);

    return () => clearInterval(timer);
}
