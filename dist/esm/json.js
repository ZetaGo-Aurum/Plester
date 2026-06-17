const ORIGINAL_PARSE = JSON.parse.bind(JSON);
function skipWhitespace(str, i) {
    while (i < str.length && (str[i] === ' ' || str[i] === '\n' || str[i] === '\t' || str[i] === '\r')) {
        i++;
    }
    return i;
}
function stripComments(str) {
    let result = '';
    let i = 0;
    while (i < str.length) {
        if (str[i] === '"' || str[i] === "'") {
            const quote = str[i];
            result += str[i];
            i++;
            while (i < str.length) {
                result += str[i];
                if (str[i] === '\\') {
                    i++;
                    if (i < str.length) {
                        result += str[i];
                        i++;
                    }
                    continue;
                }
                if (str[i] === quote) {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }
        if (str[i] === '/' && i + 1 < str.length && str[i + 1] === '/') {
            i += 2;
            while (i < str.length && str[i] !== '\n')
                i++;
            continue;
        }
        if (str[i] === '/' && i + 1 < str.length && str[i + 1] === '*') {
            i += 2;
            while (i < str.length && !(str[i] === '*' && i + 1 < str.length && str[i + 1] === '/'))
                i++;
            i += 2;
            continue;
        }
        result += str[i];
        i++;
    }
    return result;
}
function healJSON(str) {
    str = str.trim();
    str = stripComments(str);
    str = str.trim();
    const out = [];
    const stack = [];
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
                    if (i < str.length)
                        out.push(str[i]);
                    i++;
                }
                else if (str[i] === quote) {
                    out.push('"');
                    i++;
                    break;
                }
                else {
                    out.push(str[i]);
                    i++;
                }
            }
            continue;
        }
        if (ch === '{') {
            stack.push('}');
            out.push('{');
            i++;
            continue;
        }
        if (ch === '[') {
            stack.push(']');
            out.push('[');
            i++;
            continue;
        }
        if (ch === '}') {
            if (stack.length > 0 && stack[stack.length - 1] === '}')
                stack.pop();
            out.push('}');
            i++;
            continue;
        }
        if (ch === ']') {
            if (stack.length > 0 && stack[stack.length - 1] === ']')
                stack.pop();
            out.push(']');
            i++;
            continue;
        }
        if (ch === ',') {
            i = skipWhitespace(str, i + 1);
            if (i >= str.length || str[i] === '}' || str[i] === ']')
                continue;
            out.push(',');
            continue;
        }
        if (ch === ':' || ch === ' ') {
            out.push(ch);
            i++;
            continue;
        }
        if (ch === ';') {
            i++;
            continue;
        }
        if (/[a-zA-Z_$]/.test(ch)) {
            let word = '';
            while (i < str.length && /[a-zA-Z0-9_$.]/.test(str[i])) {
                word += str[i];
                i++;
            }
            const after = skipWhitespace(str, i);
            if (after < str.length && str[after] === ':') {
                out.push('"' + word + '"');
                continue;
            }
            const lower = word.toLowerCase();
            if (lower === 'undefined') {
                out.push('null');
                continue;
            }
            if (lower === 'nan' || lower === 'infinity') {
                out.push('null');
                continue;
            }
            out.push(word);
            continue;
        }
        if (ch === '0' && i + 1 < str.length && (str[i + 1] === 'x' || str[i + 1] === 'X')) {
            let hex = '0x';
            i += 2;
            while (i < str.length && /[0-9a-fA-F]/.test(str[i])) {
                hex += str[i];
                i++;
            }
            out.push(String(parseInt(hex, 16)));
            continue;
        }
        out.push(ch);
        i++;
    }
    while (stack.length > 0)
        out.push(stack.pop());
    return out.join('');
}
export function patchJSON() {
    JSON.parse = function parse(text, reviver) {
        try {
            return ORIGINAL_PARSE(text, reviver);
        }
        catch (e) {
            if (!(e instanceof SyntaxError))
                throw e;
            try {
                const healed = healJSON(text);
                return ORIGINAL_PARSE(healed, reviver);
            }
            catch {
                throw e;
            }
        }
    };
}
export function unpatchJSON() {
    if (JSON.parse !== ORIGINAL_PARSE) {
        JSON.parse = ORIGINAL_PARSE;
    }
}
//# sourceMappingURL=json.js.map