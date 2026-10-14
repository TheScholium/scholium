/**
 * Tidy what the handwriting recognizer returns into something the parser
 * understands. Recognizers are built for prose: they turn x² into "x2",
 * multiplication into "X", and minus signs into dashes.
 */
import { normalize } from './expr';

export function cleanRecognized(raw: string): string[] {
  return raw
    .split(/[\r\n]+/)
    .map((l) => normalize(l)
      .replace(/[“”"']/g, (m) => (m === "'" ? "'" : ''))
      .replace(/\bX\b/g, 'x').replace(/\bY\b/g, 'y')
      .replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1*')       // 3 x 4 -> 3*4
      .replace(/(^|[^a-z])([xytr])(\d)/g, '$1$2^$3')  // x2 -> x^2 (2x stays 2x)
      .replace(/\)(\d)/g, ')^$1')                      // (x+1)2 -> (x+1)^2
      .replace(/\s+/g, ' ')
      .trim())
    .filter((l) => l.length > 0)
    .slice(0, 3);
}
