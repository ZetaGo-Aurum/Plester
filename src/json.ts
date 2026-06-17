const ORIGINAL_PARSE: typeof JSON.parse = JSON.parse.bind(JSON);

function skipWhitespace(str: string, i: number): number {
  while (i < str.length && (str[i] === ' ' || str[i] === '\n' || str[i] === '\t' || str[i] === '\r')) {
    i++;
  }
  return i;
}

function healJSON(str: string): string {
  str = str.trim();
  const out: string[] = [];
  const stack: string[] = [];
  let i = 0;

  while (i < str.length) {
    const ch = str[i];

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

    if (ch === '{') { stack.push('}'); out.push('{'); i++; continue; }
    if (ch === '[') { stack.push(']'); out.push('['); i++; continue; }

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

    if (ch === ',') {
      i = skipWhitespace(str, i + 1);
      if (i >= str.length || str[i] === '}' || str[i] === ']') continue;
      out.push(',');
      continue;
    }

    if (ch === ':' || ch === ' ') { out.push(ch); i++; continue; }

    if (/[a-zA-Z_$]/.test(ch)) {
      let word = '';
      while (i < str.length && /[a-zA-Z0-9_$.]/.test(str[i])) {
        word += str[i];
        i++;
      }
      const after = skipWhitespace(str, i);
      if (after < str.length && str[after] === ':') {
        out.push('"' + word + '"');
      } else {
        out.push(word === 'undefined' ? 'null' : word);
      }
      continue;
    }

    out.push(ch);
    i++;
  }

  while (stack.length > 0) out.push(stack.pop()!);

  return out.join('');
}

export function patchJSON(): void {
  JSON.parse = function parse(this: unknown, text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown): unknown {
    try {
      return ORIGINAL_PARSE(text, reviver as any);
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
      const healed = healJSON(text);
      try {
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
