/**
 * Reads text from the clipboard
 * @returns `Promise` from `navigator.clipboard.readText`
 */
export function readText() {
    return navigator.clipboard.readText();
}

/**
 * Writes text to the clipboard
 * @param data Text to write
 * @returns `Promise` from `navigator.clipboard.writeText`
 */
export function writeText(data: string) {
    return navigator.clipboard.writeText(data);
}

/**
 * See https://stackoverflow.com/a/1527820. Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min and no greater than max
 * Using Math.round() will give you a non-uniform distribution!
 * @param min Minimum value to generate
 * @param max Maximum value to generate
 */
export function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}