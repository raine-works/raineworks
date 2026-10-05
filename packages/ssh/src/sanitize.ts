// Strips C0/C1 control characters (including ESC) so content can never inject terminal escape sequences.
// Newlines and tabs are normalised to spaces; screens do their own wrapping.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

export function sanitize(text: string): string {
	return text.replace(CONTROL_CHARS, ' ');
}
