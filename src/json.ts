/* ═══════════════════════════════════════════════════════════════════ */
/*  Advanced JSON Healer — Dual-Pass · Token-Level · Multi-Repair   */
/* ═══════════════════════════════════════════════════════════════════ */

const ORIGINAL_PARSE: typeof JSON.parse = JSON.parse.bind(JSON);

function skipWhitespace(str: string, i: number): number {
  while (i < str.length && (str[i] === ' ' || str[i] === '\n' || str[i] === '\t' || str[i] === '\r')) {
    i++;
  }
  return i;
}

function stripComments(str: string): string {
  let result = '';
  let i = 0;

  while (i < str.length) {
    // String literal — pass through
    if (str[i] === '"' || str[i] === "'") {
      const quote = str[i];
      result += str[i];
      i++;
      while (i < str.length) {
        result += str[i];
        if (str[i] === '\\') { i++; if (i < str.length) { result += str[i]; i++; } continue; }
        if (str[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }

    // Single-line comment
    if (str[i] === '/' && i + 1 < str.length && str[i + 1] === '/') {
      i += 2;
      while (i < str.length && str[i] !== '\n') i++;
      continue;
    }

    // Multi-line comment
    if (str[i] === '/' && i + 1 < str.length && str[i + 1] === '*') {
      i += 2;
      while (i < str.length && !(str[i] === '*' && i + 1 < str.length && str[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    result += str[i];
    i++;
  }

  return result;
}

function healJSON(str: string): string {
  str = str.trim();
  str = stripComments(str);
  str = str.trim();

  const out: string[] = [];
  const stack: string[] = [];
  let i = 0;

  while (i < str.length) {
    const ch = str[i];

    // String literal
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out.push('"');
      i++;
      while (i < str.length) {
        if (str[i] === '\\') {
          out.push('\\');
          i++;
          if (i < str.length) out.push(str[i]);
          i++;
        } else if (str[i] === quote) {
          out.push('"');
          i++;
          break;
        } else {
          out.push(str[i]);
          i++;
        }
      }
      continue;
    }

    // Object / Array open
    if (ch === '{') { stack.push('}'); out.push('{'); i++; continue; }
    if (ch === '[') { stack.push(']'); out.push('['); i++; continue; }

    // Object / Array close
    if (ch === '}') {
      if (stack.length > 0 && stack[stack.length - 1] === '}') stack.pop();
      out.push('}');
      i++;
      continue;
    }
    if (ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ']') stack.pop();
      out.push(']');
      i++;
      continue;
    }

    // Comma — handle trailing
    if (ch === ',') {
      i = skipWhitespace(str, i + 1);
      if (i >= str.length || str[i] === '}' || str[i] === ']') continue;
      out.push(',');
      continue;
    }

    // Colon, whitespace
    if (ch === ':' || ch === ' ') { out.push(ch); i++; continue; }

    // Semicolon — strip (common JSON-in-JS mistake)
    if (ch === ';') { i++; continue; }

    // Identifier / keyword start
    if (/[a-zA-Z_$]/.test(ch)) {
      let word = '';
      while (i < str.length && /[a-zA-Z0-9_$.]/.test(str[i])) {
        word += str[i];
        i++;
      }
      const after = skipWhitespace(str, i);

      // If followed by colon → it's an unquoted key
      if (after < str.length && str[after] === ':') {
        out.push('"' + word + '"');
        continue;
      }

      // Known value keywords
      const lower = word.toLowerCase();
      if (lower === 'undefined') { out.push('null'); continue; }
      if (lower === 'nan' || lower === 'infinity') { out.push('null'); continue; }

      out.push(word);
      continue;
    }

    // Hex literal (0xFF, 0xDEAD, etc.)
    if (ch === '0' && i + 1 < str.length && (str[i + 1] === 'x' || str[i + 1] === 'X')) {
      let hex = '0x';
      i += 2;
      while (i < str.length && /[0-9a-fA-F]/.test(str[i])) { hex += str[i]; i++; }
      out.push(String(parseInt(hex, 16)));
      continue;
    }

    out.push(ch);
    i++;
  }

  // Auto-close unclosed structures
  while (stack.length > 0) out.push(stack.pop()!);

  return out.join('');
}

export function patchJSON(): void {
  JSON.parse = function parse(this: unknown, text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown): unknown {
    try {
      return ORIGINAL_PARSE(text, reviver as any);
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
      try {
        const healed = healJSON(text);
        return ORIGINAL_PARSE(healed, reviver as any);
      } catch {
        throw e;
      }
    }
  } as typeof JSON.parse;
}

export function unpatchJSON(): void {
  if (JSON.parse !== ORIGINAL_PARSE) {
    JSON.parse = ORIGINAL_PARSE;
  }
}
