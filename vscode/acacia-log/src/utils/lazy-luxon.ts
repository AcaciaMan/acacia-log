import type { DateTime as DateTimeType } from 'luxon';

let _DateTime: typeof DateTimeType | undefined;

/**
 * Lazily loads and returns the luxon DateTime class.
 * First call performs the require(); subsequent calls return cached reference.
 */
export function getLuxonDateTime(): typeof DateTimeType {
    if (!_DateTime) {
        _DateTime = require('luxon').DateTime;
    }
    return _DateTime!;
}
