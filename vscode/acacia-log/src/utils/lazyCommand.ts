/**
 * Creates a command handler that lazily loads its implementation module.
 * The module is loaded via dynamic require() on first invocation, then cached.
 * 
 * @param moduleLoader - Function that dynamically requires the module and returns the handler
 * @returns A command handler function that lazily loads the real implementation
 */
export function lazyCommand<T extends (...args: any[]) => any>(
    moduleLoader: () => T
): (...args: Parameters<T>) => ReturnType<T> {
    let cached: T | undefined;
    return (...args: Parameters<T>): ReturnType<T> => {
        if (!cached) {
            cached = moduleLoader();
        }
        return cached(...args);
    };
}
