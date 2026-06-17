"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchJSON = patchJSON;
exports.unpatchJSON = unpatchJSON;
const ORIGINAL_PARSE = JSON.parse.bind(JSON);
function skipWhitespace(str, i) {
    while (i < str.length && (str[i] === ' ' || str[i] === '\n' || str[i] === '\t' || str[i] === '\r')) {
        i++;
    }
    return i;
}
function healJSON(str) {
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
        if (/[a-zA-Z_$]/.test(ch)) {
            let word = '';
            while (i < str.length && /[a-zA-Z0-9_$.]/.test(str[i])) {
                word += str[i];
                i++;
            }
            const after = skipWhitespace(str, i);
            if (after < str.length && str[after] === ':') {
                out.push('"' + word + '"');
            }
            else {
                out.push(word === 'undefined' ? 'null' : word);
            }
            continue;
        }
        out.push(ch);
        i++;
    }
    while (stack.length > 0)
        out.push(stack.pop());
    return out.join('');
}
function patchJSON() {
    JSON.parse = function parse(text, reviver) {
        try {
            return ORIGINAL_PARSE(text, reviver);
        }
        catch (e) {
            if (!(e instanceof SyntaxError))
                throw e;
            const healed = healJSON(text);
            try {
                return ORIGINAL_PARSE(healed, reviver);
            }
            catch {
                throw e;
            }
        }
    };
}
function unpatchJSON() {
    if (JSON.parse !== ORIGINAL_PARSE) {
        JSON.parse = ORIGINAL_PARSE;
    }
}
//# sourceMappingURL=json.js.map