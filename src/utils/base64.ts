// Pure JS Base64 decoder compatible with React Native Hermes, Web, and Node
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function decodeBase64(input: string): string {
  if (typeof globalThis.atob === 'function') {
    try {
      return globalThis.atob(input);
    } catch {
      // Fallback to manual decode if atob fails
    }
  }

  const str = String(input).replace(/[=]+$/, '');
  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 string');
  }

  let output = '';
  for (
    let bc = 0, bs = 0, buffer: number, idx = 0;
    (buffer = str.charCodeAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = CHARS.indexOf(String.fromCharCode(buffer));
  }

  return output;
}
