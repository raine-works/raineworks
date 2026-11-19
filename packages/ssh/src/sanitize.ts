/**
 * Text from content made safe for a terminal: C0/C1 control characters (ESC included) become spaces, so content
 * can never inject escape sequences. Newlines and tabs too; screens do their own wrapping.
 *
 * @module sanitize
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

export function sanitize(text: string): string {
	return text.replace(CONTROL_CHARS, ' ');
}
