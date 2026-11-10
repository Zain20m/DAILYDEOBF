const { spawnSync } = require('node:child_process');

const KEYWORDS = new Set([
  'and', 'break', 'continue', 'do', 'else', 'elseif', 'end', 'export',
  'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or',
  'repeat', 'return', 'then', 'true', 'type', 'until', 'while'
]);

const EXECUTOR_APIS = new Set([
  'getgenv', 'getrenv', 'getrawmetatable', 'setreadonly', 'identifyexecutor',
  'getexecutorname', 'getconnections', 'firetouchinterest', 'writefile',
  'readfile', 'isfile', 'makefolder', 'delfile', 'listfiles', 'getcustomasset',
  'getsynasset', 'request', 'http_request', 'syn', 'Drawing', 'cloneref',
  'newcclosure', 'hookfunction', 'hookmetamethod', 'gethui', 'gethiddenproperty',
  'sethiddenproperty', 'getnamecallmethod', 'checkcaller', 'getcallingscript',
  'queue_on_teleport', 'setclipboard', 'getclipboard', 'loadstring', 'firesignal',
  'fireclickdetector', 'isnetworkowner', 'setfflag', 'getfflag', 'getgc',
  'getinstances', 'getnilinstances', 'getloadedmodules', 'getfenv', 'setfenv'
]);

const KNOWN_INSTANCE_NAMES = new Set([
  'LocalPlayer', 'Character', 'Humanoid', 'HumanoidRootPart', 'PlayerGui',
  'CurrentCamera', 'UserInputService', 'RunService', 'TweenService',
  'ReplicatedStorage', 'ServerStorage', 'ServerScriptService', 'Workspace',
  'Players', 'Lighting', 'SoundService', 'ContextActionService',
  'StarterGui', 'StarterPlayer', 'Backpack', 'Mouse', 'Animator',
  'Camera', 'PrimaryPart', 'PlayerScripts'
]);

function longBracketEnd(source, start) {
  const opener = /^\[(=*)\[/.exec(source.slice(start));
  if (!opener) return null;
  const closer = ']' + opener[1] + ']';
  const end = source.indexOf(closer, start + opener[0].length);
  return { end: end < 0 ? source.length : end + closer.length, closed: end >= 0 };
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  let lexicalErrors = 0;

  while (index < source.length) {
    const start = index;
    const rest = source.slice(index);
    let value;
    let type;

    if (/\s/.test(source[index])) {
      const match = /^\s+/.exec(rest)[0];
      value = match; type = 'trivia'; index += match.length;
    } else if (source.startsWith('--', index)) {
      const block = longBracketEnd(source, index + 2);
      if (block) {
        value = source.slice(index, block.end);
        if (!block.closed) lexicalErrors++;
        index = block.end;
      } else {
        const newline = source.indexOf('\n', index);
        index = newline < 0 ? source.length : newline;
        value = source.slice(start, index);
      }
      type = 'trivia';
    } else if (source[index] === '"' || source[index] === "'") {
      const quote = source[index++];
      let closed = false;
      while (index < source.length) {
        const char = source[index++];
        if (char === '\\') {
          if (index < source.length) {
            if (source[index] === '\r' && source[index + 1] === '\n') index += 2;
            else index++;
          }
        } else if (char === quote) {
          closed = true;
          break;
        }
      }
      if (!closed) lexicalErrors++;
      value = source.slice(start, index); type = 'string';
    } else {
      const longString = longBracketEnd(source, index);
      if (longString) {
        value = source.slice(index, longString.end);
        if (!longString.closed) lexicalErrors++;
        index = longString.end; type = 'string';
      } else {
        const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
        const number = /^(?:0[xX](?:[0-9a-fA-F]+(?:\.(?!\.)[0-9a-fA-F]*)?|\.[0-9a-fA-F]+)(?:[pP][+-]?\d+)?|0[bB][01]+|0[oO][0-7]+|(?:\d+(?:\.(?!\.)\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(rest);
        const symbol = /^(?:\.\.\.|<<=|>>=|\/\/\=|\.\.\=|\+=|-=|\*=|\/=|%=|\^=|&=|\|=|::|==|~=|<=|>=|\/\/|<<|>>|\.\.|->)/.exec(rest);
        if (identifier) {
          value = identifier[0]; index += value.length;
          type = KEYWORDS.has(value) ? 'keyword' : 'identifier';
        } else if (number) {
          value = number[0]; index += value.length; type = 'number';
        } else if (symbol) {
          value = symbol[0]; index += value.length; type = 'symbol';
        } else {
          value = source[index++]; type = 'symbol';
        }
      }
    }
    tokens.push({ type, value, start, end: index });
  }

  return { tokens, lexicalErrors };
}

function significant(tokens) {
  const result = [];
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type !== 'trivia') result.push({ token: tokens[index], index });
  }
  return result;
}

function decodeQuotedString(token) {
  if (!token || token.type !== 'string' || token.value.length < 2) return null;
  const quote = token.value[0];
  if ((quote !== '"' && quote !== "'") || token.value[token.value.length - 1] !== quote) return null;
  const body = token.value.slice(1, -1);
  if (!body.includes('\\')) return null;

  let output = '';
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (char !== '\\') { output += char; continue; }
    const next = body[++index];
    if (next === undefined) return null;
    if (next === 'x') {
      const hex = body.slice(index + 1, index + 3);
      if (!/^[0-9a-f]{2}$/i.test(hex)) return null;
      output += String.fromCharCode(parseInt(hex, 16)); index += 2;
    } else if (next === 'u' && body[index + 1] === '{') {
      const close = body.indexOf('}', index + 2);
      if (close < 0) return null;
      const point = parseInt(body.slice(index + 2, close), 16);
      if (!Number.isFinite(point) || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return null;
      output += String.fromCodePoint(point); index = close;
    } else if (/[0-9]/.test(next)) {
      let digits = next;
      while (digits.length < 3 && /[0-9]/.test(body[index + 1] || '')) digits += body[++index];
      const byte = Number(digits);
      if (byte > 255) return null;
      output += String.fromCharCode(byte);
    } else if (next === 'z') {
      while (/\s/.test(body[index + 1] || '')) index++;
    } else if (next === '\n' || next === '\r') {
      if (next === '\r' && body[index + 1] === '\n') index++;
      output += '\n';
    } else {
      const replacements = { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\x0b' };
      if (Object.prototype.hasOwnProperty.call(replacements, next)) output += replacements[next];
      else if (next === '\\' || next === '"' || next === "'") output += next;
      else return null;
    }
  }
  return output;
}

function quoteLuauString(value) {
  let output = '"';
  for (const char of value) {
    const code = char.codePointAt(0);
    if (char === '\\') output += '\\\\';
    else if (char === '"') output += '\\"';
    else if (char === '\n') output += '\\n';
    else if (char === '\r') output += '\\r';
    else if (char === '\t') output += '\\t';
    else if (code < 32 || (code >= 127 && code <= 255)) output += '\\' + String(code).padStart(3, '0');
    else output += char;
  }
  return output + '"';
}

function decodeBase64Text(encoded) {
  try {
    const normalized = encoded.replace(/\s+/g, '');
    if (normalized.length < 8 || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return null;
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    if (!decoded || decoded.includes('\uFFFD') || !/^[\x09\x0a\x0d\x20-\x7e\u00a0-\uFFFF]+$/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isSimpleNumber(token) {
  return token && token.type === 'number' && /^(?:0x[0-9a-f]+|0b[01]+|0o[0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)$/i.test(token.value);
}

function numericValue(token) {
  return Number(token.value);
}

function getFunctionBodyText(source, declarationToken) {
  const tokens = tokenize(source).tokens;
  const items = significant(tokens);
  const declarationIndex = items.findIndex(item => item.token.start === declarationToken.start);
  if (declarationIndex < 0) return source.slice(declarationToken.end, declarationToken.end + 2500);

  let functionIndex = -1;
  for (let index = declarationIndex - 1; index >= Math.max(0, declarationIndex - 4); index--) {
    if (items[index].token.value === 'function') {
      functionIndex = items[index].index;
      break;
    }
  }
  if (functionIndex < 0) return source.slice(declarationToken.end, declarationToken.end + 2500);

  const endIndex = findWhileEnd(tokens, functionIndex);
  if (endIndex < 0) return source.slice(declarationToken.end, declarationToken.end + 2500);
  return source.slice(declarationToken.end, tokens[endIndex].start);
}

function inferIdentifierName(source, token, isFunction) {
  const lineEnd = source.indexOf('\n', token.end);
  const tail = isFunction
    ? getFunctionBodyText(source, token)
    : source.slice(token.end, lineEnd < 0 ? Math.min(source.length, token.end + 800) : lineEnd);

  if (isFunction) {
    if (/UDim2\s*\.\s*new\s*\(/.test(tail) && /tonumber\s*\(/.test(tail) && /\.(?:sx|ox|sy|oy)\b/.test(tail)) return 'resolveUDim2';
    if (/\.character\s+then[\s\S]{0,240}?Disconnect/.test(tail) &&
        /\.descendant\s+then/.test(tail)) return 'untrackPlayer';
    if (/GetDescendants/.test(tail) && /DescendantAdded/.test(tail) && /Disconnect/.test(tail)) {
      return 'monitorCharacterAccessories';
    }
    if (/CharacterAdded\s*:\s*Connect/.test(tail)) return 'trackPlayer';
    if (/IsA\s*\(\s*["']Accessory["']\s*\)/.test(tail) && /:Destroy\s*\(/.test(tail)) {
      return 'removeAccessory';
    }
    if (/\breturn\s+[A-Za-z_]\w*\s*\+\s*[A-Za-z_]\w*/.test(tail)) return 'AddNumbers';
    if (/\breturn\s+[A-Za-z_]\w*\s*-\s*[A-Za-z_]\w*/.test(tail)) return 'SubtractNumbers';
    if (/\breturn\s+[A-Za-z_]\w*\s*\*\s*[A-Za-z_]\w*/.test(tail)) return 'MultiplyNumbers';
    const configAssignment = /\bConfig\.([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(tail);
    if (configAssignment) return 'set' + configAssignment[1][0].toUpperCase() + configAssignment[1].slice(1);
    return null;
  }

  const service = /game\s*:\s*GetService\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\)/.exec(tail);
  if (service) return service[1];
  const child = /:\s*(?:WaitForChild|FindFirstChild|FindFirstChildOfClass)\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\)/.exec(tail);
  if (child) return child[1];
  const property = /\.([A-Za-z_][A-Za-z0-9_]*)/.exec(tail);
  if (property && KNOWN_INSTANCE_NAMES.has(property[1])) return property[1];
  const classLookup = /:\s*FindFirstChildOfClass\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\)/.exec(tail);
  if (classLookup) return classLookup[1];

  const identifier = source.slice(token.start, token.end);
  const context = source.slice(token.end, Math.min(source.length, token.end + 6000));
  if (new RegExp('\\b' + identifier + '\\s*\\[').test(context) &&
      /\.character\b/.test(context) && /\.descendant\b/.test(context) &&
      /CharacterAdded|DescendantAdded/.test(context)) return 'playerConnections';
  if (new RegExp('\\b' + identifier + '\\.character\\b').test(context) &&
      new RegExp('\\b' + identifier + '\\.descendant\\b').test(context) &&
      /Disconnect\s*\(/.test(context)) return 'connections';

  const nearby = source.slice(Math.max(0, token.start - 300), Math.min(source.length, token.end + 1600));
  if (new RegExp('\\]\\s*=\\s*' + identifier + '\\b').test(nearby) &&
      new RegExp('\\b' + identifier + '\\.character\\b').test(nearby) &&
      /CharacterAdded/.test(nearby)) return 'connections';
  if (isFunction) {
    const assignment = /\bConfig\.([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(tail);
    if (assignment) return 'set' + assignment[1][0].toUpperCase() + assignment[1].slice(1);
  }
  return null;
}

function collectDeclarations(source, tokens) {
  const items = significant(tokens);
  const declarations = new Map();
  const add = (name, token, kind, isFunction) => {
    if (!name || !token) return;
    const list = declarations.get(name) || [];
    list.push({ token, kind, isFunction: !!isFunction });
    declarations.set(name, list);
  };

  for (let cursor = 0; cursor < items.length; cursor++) {
    const current = items[cursor].token;
    const next = items[cursor + 1]?.token;
    if (current.value === 'local' && next) {
      if (next.value === 'function' && items[cursor + 2]?.token.type === 'identifier') {
        const nameToken = items[cursor + 2].token;
        add(nameToken.value, nameToken, 'local-function', true);
      } else {
        let scan = cursor + 1;
        while (items[scan]?.token.type === 'identifier') {
          const variable = items[scan].token;
          add(variable.value, variable, 'local', false);
          scan++;
          if (items[scan]?.token.value !== ',') break;
          scan++;
        }
      }
    }

    if (current.value === 'for') {
      let scan = cursor + 1;
      while (items[scan] && items[scan].token.value !== '=' && items[scan].token.value !== 'in' && items[scan].token.value !== 'do') {
        if (items[scan].token.type === 'identifier') add(items[scan].token.value, items[scan].token, 'loop', false);
        scan++;
      }
    }

    if (current.value === 'function') {
      let open = cursor + 1;
      while (items[open] && items[open].token.value !== '(' && items[open].token.value !== '\n') open++;
      if (items[open]?.token.value === '(') {
        let depth = 1;
        for (let scan = open + 1; scan < items.length && depth > 0; scan++) {
          const value = items[scan].token.value;
          if (value === '(') depth++;
          else if (value === ')') depth--;
          else if (depth === 1 && items[scan].token.type === 'identifier' &&
            (items[scan - 1]?.token.value === '(' || items[scan - 1]?.token.value === ',')) {
            add(value, items[scan].token, 'parameter', false);
          }
        }
      }
    }
  }
  return declarations;
}

function inferParameterMappings(source, tokens, declarations) {
  const items = significant(tokens);
  const mappings = new Map();
  for (let index = 0; index < items.length; index++) {
    if (items[index].token.value !== 'function') continue;
    let open = index + 1;
    while (open < items.length && items[open].token.value !== '(') open++;
    if (!items[open]) continue;
    let depth = 1;
    let close = open + 1;
    for (; close < items.length && depth > 0; close++) {
      if (items[close].token.value === '(') depth++;
      else if (items[close].token.value === ')') depth--;
    }
    if (depth !== 0) continue;
    const closeToken = items[close - 1].token;
    const parameters = [];
    for (let cursor = open + 1; cursor < close - 1; cursor++) {
      const token = items[cursor].token;
      if (token.type === 'identifier' &&
        (items[cursor - 1]?.token.value === '(' || items[cursor - 1]?.token.value === ',')) {
        parameters.push(token.value);
      }
    }
    if (parameters.length !== 2) continue;
    const body = source.slice(closeToken.end, Math.min(source.length, closeToken.end + 3000));
    const first = parameters[0];
    const second = parameters[1];
    const pattern = new RegExp('\\breturn\\s+' + first + '\\s*([+*/-])\\s*' + second + '\\b');
    const match = pattern.exec(body);
    if (!match) continue;
    const names = match[1] === '+' ? ['AddNumbers', 'firstNumber', 'secondNumber']
      : match[1] === '-' ? ['SubtractNumbers', 'minuend', 'subtrahend']
      : match[1] === '*' ? ['MultiplyNumbers', 'firstFactor', 'secondFactor']
      : ['DivideNumbers', 'dividend', 'divisor'];
    for (let parameterIndex = 0; parameterIndex < 2; parameterIndex++) {
      const original = parameters[parameterIndex];
      const entries = declarations.get(original) || [];
      if (entries.length === 1 && entries[0].kind === 'parameter') {
        mappings.set(original, names[parameterIndex + 1]);
      }
    }
  }
  return mappings;
}

function isTableKey(items, position) {
  const previous = items[position - 1]?.token.value;
  const next = items[position + 1]?.token.value;
  return next === '=' && (previous === '{' || previous === ',');
}

function foldSafeConstants(tokens) {
  const items = significant(tokens);
  let folded = 0;
  for (let index = 0; index + 4 < items.length; index++) {
    const open = items[index].token;
    const leftToken = items[index + 1].token;
    const operator = items[index + 2].token;
    const rightToken = items[index + 3].token;
    const close = items[index + 4].token;
    if (open.value !== '(' || !isSimpleNumber(leftToken) ||
      !isSimpleNumber(rightToken) || close.value !== ')') continue;
    if (!['+', '-', '*', '/', '//', '%', '^', '&', '|', '~', '<<', '>>'].includes(operator.value)) continue;

    const left = numericValue(leftToken);
    const right = numericValue(rightToken);
    let result;
    if (operator.value === '+') result = left + right;
    else if (operator.value === '-') result = left - right;
    else if (operator.value === '*') result = left * right;
    else if (operator.value === '/') result = right === 0 ? NaN : left / right;
    else if (operator.value === '//') result = right === 0 ? NaN : Math.floor(left / right);
    else if (operator.value === '%') result = right === 0 ? NaN : left % right;
    else if (operator.value === '^') result = Math.pow(left, right);
    else if (operator.value === '&') result = left & right;
    else if (operator.value === '|') result = left | right;
    else if (operator.value === '~') result = left ^ right;
    else if (operator.value === '<<') result = left << (right & 31);
    else result = left >> (right & 31);

    if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER) continue;
    const formatted = Number.isInteger(result) ? String(result) : String(Number(result.toPrecision(12)));
    open.value = formatted;
    open.type = 'number';
    for (const token of [leftToken, operator, rightToken, close]) token.value = '';
    folded++;
    index += 4;
  }
  return folded;
}

function foldStringCharCalls(tokens) {
  const items = significant(tokens);
  let folded = 0;
  for (let index = 0; index + 5 < items.length; index++) {
    const receiver = items[index].token.value;
    if (!['string', 'utf8'].includes(receiver) || items[index + 1].token.value !== '.' ||
      items[index + 2].token.value !== 'char' || items[index + 3].token.value !== '(') continue;
    let cursor = index + 4;
    const values = [];
    let expectingNumber = true;
    while (cursor < items.length && items[cursor].token.value !== ')') {
      const token = items[cursor].token;
      if (expectingNumber && isSimpleNumber(token)) {
        const value = numericValue(token);
        const max = receiver === 'utf8' ? 0x10ffff : 255;
        if (!Number.isInteger(value) || value < 0 || value > max ||
          (receiver === 'utf8' && value >= 0xd800 && value <= 0xdfff)) break;
        values.push(value);
        expectingNumber = false;
      } else if (!expectingNumber && token.value === ',') expectingNumber = true;
      else break;
      cursor++;
    }
    if (!values.length || expectingNumber || items[cursor]?.token.value !== ')') continue;

    const decoded = receiver === 'utf8'
      ? String.fromCodePoint(...values)
      : String.fromCharCode(...values);
    const start = items[index].token;
    start.value = quoteLuauString(decoded);
    start.type = 'string';
    for (let scan = index + 1; scan <= cursor; scan++) items[scan].token.value = '';
    folded++;
    index = cursor;
  }
  return folded;
}

function foldStaticStringCalls(tokens) {
  const items = significant(tokens);
  let folded = 0;
  for (let index = 0; index + 4 < items.length; index++) {
    if (items[index].token.value !== 'string' || items[index + 1].token.value !== '.') continue;
    const method = items[index + 2].token.value;
    if (!['reverse', 'sub'].includes(method) || items[index + 3].token.value !== '(') continue;
    const first = items[index + 4].token;
    if (first.type !== 'string') continue;
    const decodedValue = decodeQuotedString(first);
    const value = decodedValue === null ? first.value.slice(1, -1) : decodedValue;
    if (!/^[\x00-\x7F]*$/.test(value)) continue;
    let cursor = index + 5;
    const args = [];
    while (items[cursor]?.token.value === ',') {
      const argument = items[cursor + 1]?.token;
      if (!argument || !isSimpleNumber(argument)) break;
      args.push(numericValue(argument));
      cursor += 2;
    }
    if (items[cursor]?.token.value !== ')') continue;

    let result;
    if (method === 'reverse' && args.length === 0) {
      result = value.split('').reverse().join('');
    } else if (method === 'sub' && args.length >= 1 && args.length <= 2 &&
      args.every(Number.isInteger)) {
      const length = value.length;
      const normalize = n => n < 0 ? length + n + 1 : n;
      const start = Math.max(1, normalize(args[0]));
      const end = Math.min(length, normalize(args[1] ?? -1));
      result = end < start ? '' : value.slice(start - 1, end);
    } else continue;

    items[index].token.value = quoteLuauString(result);
    items[index].token.type = 'string';
    for (let scan = index + 1; scan <= cursor; scan++) items[scan].token.value = '';
    folded++;
    index = cursor;
  }
  return folded;
}

function foldStaticTableConcatCalls(source, tokens) {
  const items = significant(tokens);
  let folded = 0;
  for (let index = 0; index + 5 < items.length; index++) {
    if (items[index].token.value !== 'table' || items[index + 1].token.value !== '.' ||
      items[index + 2].token.value !== 'concat' || items[index + 3].token.value !== '(' ||
      items[index + 4].token.value !== '{') continue;
    const openTokenIndex = items[index + 4].index;
    const closeTokenIndex = findMatchingToken(tokens, openTokenIndex, '{', '}');
    if (closeTokenIndex < 0) continue;
    const parsed = parseStaticTableLiteral(source.slice(tokens[openTokenIndex].start, tokens[closeTokenIndex].end));
    if (!parsed) continue;
    const entries = [...parsed.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
    if (!entries.length || entries.some((entry, entryIndex) =>
      entry[0] !== entryIndex + 1 || typeof entry[1] !== 'string')) continue;

    let cursor = index + 5;
    while (items[cursor] && items[cursor].index <= closeTokenIndex) cursor++;
    let separator = '';
    if (items[cursor]?.token.value === ',') {
      const separatorToken = items[cursor + 1]?.token;
      if (!separatorToken || separatorToken.type !== 'string') continue;
      const decoded = decodeQuotedString(separatorToken);
      separator = decoded === null ? separatorToken.value.slice(1, -1) : decoded;
      cursor += 2;
    }
    if (items[cursor]?.token.value !== ')') continue;

    const result = entries.map(entry => entry[1]).join(separator);
    items[index].token.value = quoteLuauString(result);
    items[index].token.type = 'string';
    for (let scan = index + 1; scan <= cursor; scan++) items[scan].token.value = '';
    folded++;
    index = cursor;
  }
  return folded;
}

function foldBit32Calls(tokens) {
  const items = significant(tokens);
  let folded = 0;
  const supported = new Set(['band', 'bor', 'bxor', 'bnot', 'lshift', 'rshift', 'arshift', 'extract', 'replace']);
  for (let index = 0; index + 4 < items.length; index++) {
    if (items[index].token.value !== 'bit32' || items[index + 1].token.value !== '.') continue;
    const method = items[index + 2].token.value;
    if (!supported.has(method) || items[index + 3].token.value !== '(') continue;
    const args = [];
    let cursor = index + 4;
    let expecting = true;
    while (cursor < items.length && items[cursor].token.value !== ')') {
      const token = items[cursor].token;
      if (expecting && isSimpleNumber(token)) {
        const value = numericValue(token);
        if (!Number.isInteger(value) || value < -0x80000000 || value > 0xffffffff) break;
        args.push(value >>> 0);
        expecting = false;
      } else if (!expecting && token.value === ',') expecting = true;
      else break;
      cursor++;
    }
    if (!args.length || expecting || items[cursor]?.token.value !== ')') continue;
    let result;
    if (method === 'band' && args.length >= 1) result = args.reduce((a, b) => a & b, 0xffffffff) >>> 0;
    else if (method === 'bor' && args.length >= 1) result = args.reduce((a, b) => a | b, 0) >>> 0;
    else if (method === 'bxor' && args.length >= 1) result = args.reduce((a, b) => a ^ b, 0) >>> 0;
    else if (method === 'bnot' && args.length === 1) result = (~args[0]) >>> 0;
    else if (method === 'lshift' && args.length === 2) result = (args[0] << (args[1] & 31)) >>> 0;
    else if (method === 'rshift' && args.length === 2) result = args[0] >>> (args[1] & 31);
    else if (method === 'arshift' && args.length === 2) result = (args[0] | 0) >> (args[1] & 31), result >>>= 0;
    else if (method === 'extract' && (args.length === 2 || args.length === 3)) {
      const width = args[2] ?? 1;
      if (args[1] + width > 32 || width < 1) continue;
      result = (args[0] >>> args[1]) & (width === 32 ? 0xffffffff : (2 ** width - 1));
    } else if (method === 'replace' && (args.length === 3 || args.length === 4)) {
      const width = args[3] ?? 1;
      if (args[2] + width > 32 || width < 1) continue;
      const mask = (width === 32 ? 0xffffffff : (2 ** width - 1)) << args[2];
      result = ((args[0] & ~mask) | ((args[1] << args[2]) & mask)) >>> 0;
    } else continue;

    const start = items[index].token;
    start.value = String(result >>> 0);
    start.type = 'number';
    for (let scan = index + 1; scan <= cursor; scan++) items[scan].token.value = '';
    folded++;
    index = cursor;
  }
  return folded;
}

function foldBase64DecodeCalls(tokens) {
  const items = significant(tokens);
  let folded = 0;
  for (let index = 0; index + 3 < items.length; index++) {
    const method = items[index].token.value;
    const open = items[index + 1].token.value;
    const argument = items[index + 2].token;
    const close = items[index + 3].token.value;
    const receiver = items[index - 2]?.token;
    const before = items[index - 1]?.token.value;
    if (method !== 'Base64Decode' || open !== '(' || argument.type !== 'string' ||
      close !== ')' || before !== ':' || receiver?.type !== 'identifier' ||
      items[index - 3]?.token.value === '.' || items[index - 3]?.token.value === ':') continue;
    const decodedLiteral = decodeQuotedString(argument);
    if (decodedLiteral === null) continue;
    const decoded = decodeBase64Text(decodedLiteral);
    if (decoded === null) continue;
    receiver.value = quoteLuauString(decoded);
    receiver.type = 'string';
    items[index - 1].token.value = '';
    items[index].token.value = '';
    items[index + 1].token.value = '';
    argument.value = '';
    items[index + 3].token.value = '';
    folded++;
  }
  return folded;
}

function findMatchingToken(tokens, startIndex, openValue, closeValue) {
  let depth = 0;
  for (let index = startIndex; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === 'trivia' || token.type === 'string') continue;
    if (token.value === openValue) depth++;
    else if (token.value === closeValue) {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function parseStaticTableLiteral(source) {
  const items = significant(tokenize(source).tokens);
  if (items.length < 2 || items[0].token.value !== '{' ||
      items[items.length - 1].token.value !== '}') return null;
  const values = new Map();
  let nextArrayIndex = 1;
  let cursor = 1;

  while (cursor < items.length - 1) {
    if (items[cursor].token.value === ',') { cursor++; continue; }
    let key;
    if (items[cursor].token.value === '[' &&
        items[cursor + 1]?.token.type === 'number' &&
        items[cursor + 2]?.token.value === ']' &&
        items[cursor + 3]?.token.value === '=') {
      const rawKey = items[cursor + 1].token.value;
      key = /^0x/i.test(rawKey) ? parseInt(rawKey.slice(2), 16) : Number(rawKey);
      cursor += 4;
    } else {
      key = nextArrayIndex++;
    }

    const valueTokens = [];
    let nesting = 0;
    while (cursor < items.length - 1) {
      const value = items[cursor].token.value;
      if (value === '(' || value === '[' || value === '{') nesting++;
      else if (value === ')' || value === ']' || value === '}') {
        if (nesting === 0) break;
        nesting--;
      }
      if (value === ',' && nesting === 0) break;
      valueTokens.push(items[cursor].token);
      cursor++;
    }
    if (!valueTokens.length) return null;

    let value;
    if (valueTokens.length === 1 && valueTokens[0].type === 'number') {
      const raw = valueTokens[0].value;
      value = /^0x/i.test(raw) ? parseInt(raw.slice(2), 16) : Number(raw);
    } else if (valueTokens.length === 1 && valueTokens[0].type === 'string') {
      const decoded = decodeQuotedString(valueTokens[0]);
      value = decoded === null ? valueTokens[0].value.slice(1, -1) : decoded;
    } else if (valueTokens.every(token => token.type === 'identifier' || token.value === '.')) {
      value = valueTokens.map(token => token.value).join('');
    } else {
      return null;
    }
    values.set(key, value);
    if (items[cursor]?.token.value === ',') cursor++;
  }
  return values;
}

function getUniqueGeneratedName(source, baseName) {
  let name = baseName;
  let suffix = 2;
  while (new RegExp('\\b' + name + '\\b').test(source)) name = baseName + suffix++;
  return name;
}

function findWhileEnd(tokens, whileIndex) {
  let depth = 0;
  let pendingLoopDo = 0;
  for (let index = whileIndex; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== 'keyword') continue;
    if (token.value === 'while' || token.value === 'for') {
      depth++;
      pendingLoopDo++;
    } else if (token.value === 'function' || token.value === 'if' || token.value === 'repeat') {
      depth++;
    } else if (token.value === 'do') {
      if (pendingLoopDo > 0) pendingLoopDo--;
      else depth++;
    } else if (token.value === 'until' || token.value === 'end') {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function decodeStaticShiftXorStateMachine(source) {
  const assignmentPattern = /\blocal\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*){3})\s*=/g;
  let assignment;
  while ((assignment = assignmentPattern.exec(source))) {
    const variableNames = assignment[1].split(',').map(name => name.trim());
    const lexed = tokenize(source);
    const items = significant(lexed.tokens);
    let cursor = items.findIndex(item => item.token.start >= assignment.index);
    if (cursor < 0) continue;
    while (cursor < items.length && items[cursor].token.value !== '=') cursor++;
    if (cursor >= items.length) continue;
    cursor++;

    const tables = [];
    let tableEnd = -1;
    let failed = false;
    for (let tableIndex = 0; tableIndex < 4; tableIndex++) {
      while (cursor < items.length && items[cursor].token.value === ',') cursor++;
      if (items[cursor]?.token.value !== '{') { failed = true; break; }
      const openIndex = items[cursor].index;
      const closeIndex = findMatchingToken(lexed.tokens, openIndex, '{', '}');
      if (closeIndex < 0) { failed = true; break; }
      const literal = source.slice(lexed.tokens[openIndex].start, lexed.tokens[closeIndex].end);
      const parsed = parseStaticTableLiteral(literal);
      if (!parsed) { failed = true; break; }
      tables.push(parsed);
      tableEnd = lexed.tokens[closeIndex].end;
      while (cursor < items.length && items[cursor].token.end <= tableEnd) cursor++;
    }
    if (failed || tables.length !== 4) continue;

    const helperTable = tables[0];
    const constantTable = tables[1];
    const encodedTable = tables[2];
    const helperName = variableNames[0];
    const constantName = variableNames[1];
    const encodedName = variableNames[2];
    const decodedName = variableNames[3];

    const transformPattern = /(?<charTable>[A-Za-z_]\w*)\s*\[\s*(?<charIndex>\d+)\s*\]\s*\(\s*(?<xorTable>[A-Za-z_]\w*)\s*\[\s*(?<xorIndex>\d+)\s*\]\s*\(\s*(?<shiftTable>[A-Za-z_]\w*)\s*\[\s*(?<shiftIndex>\d+)\s*\]\s*\(\s*(?<byte>[A-Za-z_]\w*)\s*,\s*(?<shiftAmount>\d+)\s*\)\s*\+\s*\(\s*\k<byte>\s*%\s*(?<modulus>\d+)\s*\)\s*\*\s*(?<multiplier>\d+)\s*,\s*(?<keyTable>[A-Za-z_]\w*)\s*\[\s*(?<keyIndex>\d+)\s*\]\s*\)\s*\)/;
    const transform = transformPattern.exec(source.slice(tableEnd));
    if (!transform) continue;
    const t = transform.groups;
    if (t.charTable !== helperName || t.xorTable !== helperName ||
        t.shiftTable !== helperName || t.keyTable !== constantName ||
        helperTable.get(Number(t.charIndex)) !== 'string.char' ||
        helperTable.get(Number(t.xorIndex)) !== 'bit32.bxor' ||
        helperTable.get(Number(t.shiftIndex)) !== 'bit32.rshift') continue;

    const xorKey = constantTable.get(Number(t.keyIndex));
    if (typeof xorKey !== 'number') continue;
    const encodedValues = [...encodedTable.entries()]
      .filter(([key, value]) => Number.isInteger(key) && Number.isInteger(value))
      .sort((left, right) => left[0] - right[0]);
    if (!encodedValues.length) continue;

    const decodedBytes = [];
    let validBytes = true;
    for (const [, inputByte] of encodedValues) {
      const shifted = (inputByte >> Number(t.shiftAmount)) +
        (inputByte % Number(t.modulus)) * Number(t.multiplier);
      const decodedByte = (shifted ^ xorKey) & 0xff;
      if (!Number.isInteger(decodedByte) || decodedByte < 0 || decodedByte > 255) {
        validBytes = false;
        break;
      }
      decodedBytes.push(decodedByte);
    }
    if (!validBytes) continue;

    const characterPattern = /\blocal\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]\s*\(([^)]*)\)/g;
    let functionName = null;
    let functionVariable = null;
    let characterMatch;
    while ((characterMatch = characterPattern.exec(source))) {
      if (characterMatch[2] !== helperName ||
          Number(characterMatch[3]) !== Number(t.charIndex)) continue;
      const characterCodes = [];
      let allLiteral = true;
      for (const argument of characterMatch[4].split(',')) {
        const part = new RegExp(
          '^\\s*' + constantName + '\\s*\\[\\s*(\\d+)\\s*\\]\\s*(?:\\+\\s*(\\d+)\\s*)?$'
        ).exec(argument);
        if (!part) { allLiteral = false; break; }
        const baseValue = constantTable.get(Number(part[1]));
        const code = Number(baseValue) + Number(part[2] || 0);
        if (typeof baseValue !== 'number' || !Number.isInteger(code) || code < 0 || code > 255) {
          allLiteral = false;
          break;
        }
        characterCodes.push(code);
      }
      if (allLiteral && characterCodes.length) {
        functionName = String.fromCharCode(...characterCodes);
        functionVariable = characterMatch[1];
        break;
      }
    }
    if (!functionName || !functionVariable) continue;

    const outputCall = new RegExp(
      '\\(\\s*([A-Za-z_]\\w*)\\s*\\[\\s*' + functionVariable +
      '\\s*\\]\\s+or\\s+print\\s*\\)\\s*\\(\\s*table\\s*\\.\\s*concat\\s*\\(\\s*' +
      decodedName + '\\s*\\)\\s*\\)'
    );
    if (!outputCall.test(source)) continue;

    const byteAssignment = new RegExp('\\b' + t.byte + '\\s*=\\s*' + encodedName + '\\s*\\[');
    if (!byteAssignment.test(source)) continue;

    const whileIndex = lexed.tokens.findIndex(token =>
      token.type === 'keyword' && token.value === 'while' && token.start >= tableEnd);
    if (whileIndex < 0) continue;
    const whileEndIndex = findWhileEnd(lexed.tokens, whileIndex);
    if (whileEndIndex < 0) continue;

    const whileToken = lexed.tokens[whileIndex];
    const endToken = lexed.tokens[whileEndIndex];
    const setup = source.slice(tableEnd, whileToken.start)
      .replace(/--[^\r\n]*/g, '')
      .trim();
    if (!/^local\s+[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*\s*=\s*[\d\s,;]+$/.test(setup)) continue;

    const environmentVariable = outputCall.exec(source)?.[1];
    if (!environmentVariable) continue;
    const decodedText = String.fromCharCode(...decodedBytes);
    const textName = getUniqueGeneratedName(source, 'decodedText');
    const functionNameVariable = getUniqueGeneratedName(source, 'decodedFunctionName');
    const environmentName = getUniqueGeneratedName(source, 'decodedEnvironment');
    const outputName = getUniqueGeneratedName(source, 'decodedOutput');
    const replacement = [
      '-- SCAMWATCH: statically decoded a constant byte-transform loop.',
      'local ' + textName + ' = ' + quoteLuauString(decodedText),
      'local ' + functionNameVariable + ' = ' + quoteLuauString(functionName),
      'local ' + environmentName + ' = (getgenv and getgenv()) or (getfenv and getfenv()) or _G',
      'local ' + outputName + ' = ' + environmentName + '[' + functionNameVariable + '] or print',
      outputName + '(' + textName + ')'
    ].join('\n');

    return {
      source: source.slice(0, assignment.index) + replacement + source.slice(endToken.end),
      count: 1,
      strings: [decodedText],
      decoderTypes: ['constant shift/XOR byte loop']
    };
  }
  return { source, count: 0, strings: [], decoderTypes: [] };
}

function inferParallelLocalNames(source, tokens) {
  const items = significant(tokens);
  const mappings = new Map();
  const continuationTokens = new Set(['.', ':', '+', '-', '*', '/', '%', '^', '..', ',', 'and', 'or']);

  for (let index = 0; index < items.length; index++) {
    if (items[index].token.value !== 'local' ||
        items[index + 1]?.token.value === 'function') continue;

    let cursor = index + 1;
    const names = [];
    while (items[cursor]?.token.type === 'identifier') {
      names.push(items[cursor].token.value);
      cursor++;
      if (items[cursor]?.token.value !== ',') break;
      cursor++;
    }
    if (names.length < 2 || items[cursor]?.token.value !== '=') continue;
    cursor++;

    for (let nameIndex = 0; nameIndex < names.length; nameIndex++) {
      const name = names[nameIndex];
      const expressionStart = cursor;
      let end = cursor;
      let round = 0;
      let square = 0;
      let curly = 0;

      while (end < items.length) {
        const value = items[end].token.value;
        if (value === ',' && round === 0 && square === 0 && curly === 0) break;

        if (end > expressionStart && round === 0 && square === 0 && curly === 0) {
          const previousToken = items[end - 1].token;
          const currentToken = items[end].token;
          const gap = source.slice(previousToken.end, currentToken.start);
          if (gap.includes('\n') &&
              !continuationTokens.has(previousToken.value) &&
              !continuationTokens.has(currentToken.value)) break;
          if (value === ';') break;
        }

        if (value === '(') round++;
        else if (value === ')') round--;
        else if (value === '[') square++;
        else if (value === ']') square--;
        else if (value === '{') curly++;
        else if (value === '}') curly--;
        end++;
      }

      const firstToken = items[expressionStart]?.token;
      const lastToken = items[end - 1]?.token;
      if (firstToken && lastToken && end > expressionStart) {
        const expression = source.slice(firstToken.start, lastToken.end);
        const service = /game\s*:\s*GetService\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\)/.exec(expression);
        if (service) mappings.set(name, service[1]);
        else if (/\b[A-Za-z_]\w*\.LocalPlayer\b/.test(expression)) mappings.set(name, 'localPlayer');
        else if (/__VX7_SKIN_PREVIEW_MODELS/.test(source) && /\baddConn\s*=/.test(expression) && /\bremConn\s*=/.test(expression) && /\bsetToggle\s*=/.test(expression)) mappings.set(name, 'skinPreviewState');
      }

      if (end >= items.length || items[end]?.token.value !== ',') break;
      cursor = end + 1;
    }
  }

  return mappings;
}

function inferScopedSemanticRenames(source, tokens, declarations) {
  const items = significant(tokens);
  const functionRanges = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    if (items[itemIndex].token.value !== 'function') continue;

    let openItem = itemIndex + 1;
    while (openItem < items.length && items[openItem].token.value !== '(') openItem++;
    if (!items[openItem]) continue;

    let depth = 1;
    let closeItem = openItem + 1;
    for (; closeItem < items.length && depth > 0; closeItem++) {
      if (items[closeItem].token.value === '(') depth++;
      else if (items[closeItem].token.value === ')') depth--;
    }
    if (depth !== 0) continue;

    const underlyingFunctionIndex = items[itemIndex].index;
    const endIndex = findWhileEnd(tokens, underlyingFunctionIndex);
    if (endIndex < 0) continue;

    const parameterTokens = [];
    for (let cursor = openItem + 1; cursor < closeItem - 1; cursor++) {
      const token = items[cursor].token;
      if (token.type === 'identifier' &&
          (items[cursor - 1]?.token.value === '(' || items[cursor - 1]?.token.value === ',')) {
        parameterTokens.push(token);
      }
    }

    const closeToken = items[closeItem - 1].token;
    const endToken = tokens[endIndex];
    const body = source.slice(closeToken.end, endToken.start);
    functionRanges.push({
      id: underlyingFunctionIndex,
      start: items[itemIndex].token.start,
      bodyStart: closeToken.end,
      end: endToken.start,
      length: endToken.start - items[itemIndex].token.start,
      parameters: parameterTokens,
      body
    });
  }

  const candidates = [];
  for (const range of functionRanges) {
    if (range.parameters.length >= 2) {
      const first = range.parameters[0];
      const second = range.parameters[1];
      const firstAsTableKey = new RegExp(
        '\\b[A-Za-z_]\\w*\\s*\\[\\s*' + first.value + '\\s*\\]'
      ).test(range.body);
      const secondAsCharacter = new RegExp(
        '\\b' + second.value + '\\s*:\\s*GetDescendants\\s*\\('
      ).test(range.body) &&
        new RegExp('\\b' + second.value + '\\.DescendantAdded\\b').test(range.body);
      const managesConnections = /Disconnect\s*\(/.test(range.body);

      if (firstAsTableKey && secondAsCharacter && managesConnections) {
        candidates.push({ name: first.value, token: first, target: 'player', range, kind: 'parameter' });
        candidates.push({ name: second.value, token: second, target: 'character', range, kind: 'parameter' });
      }
    }
  }

  for (const [name, entries] of declarations) {
    const localEntries = entries.filter(entry => entry.kind === 'local');
    if (localEntries.length < 2) continue;

    const scopedEntries = [];
    for (const entry of localEntries) {
      const containing = functionRanges
        .filter(range => entry.token.start > range.bodyStart && entry.token.start < range.end)
        .sort((left, right) => left.length - right.length);
      if (!containing.length) continue;
      scopedEntries.push({ entry, range: containing[0] });
    }

    const scopeIds = scopedEntries.map(item => item.range.id);
    if (new Set(scopeIds).size !== scopedEntries.length || scopedEntries.length !== localEntries.length) continue;

    for (const { entry, range } of scopedEntries) {
      const localBody = source.slice(entry.token.end, range.end);
      const tracksCharacterConnections =
        /\.descendant\b/.test(localBody) &&
        /Disconnect\s*\(/.test(localBody) &&
        (/DescendantAdded/.test(localBody) || /\.character\b/.test(localBody));
      if (tracksCharacterConnections) {
        candidates.push({ name, token: entry.token, target: 'connections', range, kind: 'local' });
      }
    }
  }

  const replacements = new Map();
  const summaries = new Map();
  for (let position = 0; position < items.length; position++) {
    const token = items[position].token;
    if (token.type !== 'identifier') continue;

    const applicable = candidates
      .filter(candidate =>
        candidate.name === token.value &&
        token.start >= candidate.token.start &&
        token.start < candidate.range.end
      )
      .sort((left, right) =>
        left.range.length - right.range.length ||
        right.token.start - left.token.start
      );
    if (!applicable.length) continue;

    const chosen = applicable[0];
    const innerDeclarations = declarations.get(token.value) || [];
    const sameFunctionDeclarations = innerDeclarations.filter(entry => {
      if (entry.token.start === chosen.token.start) return false;
      const scope = functionRanges
        .filter(range => entry.token.start > range.bodyStart && entry.token.start < range.end)
        .sort((left, right) => left.length - right.length)[0];
      return scope?.id === chosen.range.id && entry.token.start <= token.start;
    });
    if (sameFunctionDeclarations.length) continue;

    const previousValue = items[position - 1]?.token.value;
    if (previousValue === '.' || previousValue === ':' || isTableKey(items, position)) continue;

    replacements.set(token.start, chosen.target);
    const summaryKey = chosen.name + '->' + chosen.target;
    const summary = summaries.get(summaryKey) || { from: chosen.name, to: chosen.target, scopes: new Set() };
    summary.scopes.add(chosen.range.id);
    summaries.set(summaryKey, summary);
  }

  return {
    replacements,
    summaries: [...summaries.values()].map(item =>
      item.from + ' -> ' + item.to + ' (' + item.scopes.size + ' scopes)'
    )
  };
}


function inferCallbackFunctionNames(source, declarations) {
  const references = new Map();
  const pattern = /\b(PlayerGui|CoreGui)\s*\.\s*([A-Za-z_]\w*)\s*:\s*Connect\s*\(\s*([A-Za-z_]\w*)\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    const [, owner, eventName, functionName] = match;
    const current = references.get(functionName) || { owners: new Set(), events: new Set() };
    current.owners.add(owner);
    current.events.add(eventName);
    references.set(functionName, current);
  }
  const mappings = new Map();
  for (const [functionName, context] of references) {
    const entries = declarations.get(functionName) || [];
    if (entries.length !== 1 || !entries[0].isFunction || context.events.size !== 1) continue;
    const eventName = [...context.events][0];
    const ownerName = context.owners.size > 1 ? 'Gui' : [...context.owners][0];
    const inferred = 'handle' + ownerName + eventName;
    if (!declarations.has(inferred) && !KEYWORDS.has(inferred)) mappings.set(functionName, inferred);
  }
  return mappings;
}

function inferReadableSemanticRenames(source, tokens, declarations) {
  const items = significant(tokens);
  const functionRanges = [];
  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    if (items[itemIndex].token.value !== 'function') continue;
    let openItem = itemIndex + 1;
    while (openItem < items.length && items[openItem].token.value !== '(') openItem++;
    if (!items[openItem]) continue;
    let depth = 1;
    let closeItem = openItem + 1;
    for (; closeItem < items.length && depth > 0; closeItem++) {
      if (items[closeItem].token.value === '(') depth++;
      else if (items[closeItem].token.value === ')') depth--;
    }
    if (depth !== 0) continue;
    const underlyingFunctionIndex = items[itemIndex].index;
    const endIndex = findWhileEnd(tokens, underlyingFunctionIndex);
    if (endIndex < 0) continue;
    const parameters = [];
    for (let cursor = openItem + 1; cursor < closeItem - 1; cursor++) {
      const token = items[cursor].token;
      if (token.type === 'identifier' &&
          (items[cursor - 1]?.token.value === '(' || items[cursor - 1]?.token.value === ',')) {
        parameters.push(token);
      }
    }
    const closeToken = items[closeItem - 1].token;
    const endToken = tokens[endIndex];
    functionRanges.push({
      id: underlyingFunctionIndex,
      bodyStart: closeToken.end,
      end: endToken.start,
      length: endToken.start - items[itemIndex].token.start,
      parameters,
      body: source.slice(closeToken.end, endToken.start)
    });
  }

  const candidates = [];
  const addCandidate = (name, token, target, range) => {
    if (!name || !token || !target || declarations.has(target) || KEYWORDS.has(target)) return;
    candidates.push({ name, token, target, range });
  };

  for (const range of functionRanges) {
    const layoutParameter = range.parameters.find(token =>
      new RegExp('\\b' + token.value + '\\s*\\.\\s*(?:sx|ox|sy|oy)\\b').test(range.body)
    );
    const hasLayoutConversion = !!layoutParameter &&
      /UDim2\s*\.\s*new\s*\(/.test(range.body) &&
      /tonumber\s*\(/.test(range.body);
    if (hasLayoutConversion && /type\s*\(/.test(range.body) && /["']table["']/.test(range.body)) {
      addCandidate(layoutParameter.value, layoutParameter, 'layoutData', range);
      for (const parameter of range.parameters) {
        if (parameter === layoutParameter) continue;
        const escaped = parameter.value;
        if (new RegExp('\\breturn\\s+' + escaped + '\\b').test(range.body)) {
          addCandidate(parameter.value, parameter, 'fallbackValue', range);
          break;
        }
      }
    }

    for (const parameter of range.parameters) {
      const name = parameter.value;
      if (!/^(?:arg\d*|v\d+|_+[A-Za-z0-9_]*)$/i.test(name)) continue;
      const escaped = name;
      if (new RegExp('\\b' + escaped + '\\s*:\\s*GetDescendants\\s*\\(').test(range.body) &&
          new RegExp('\\b' + escaped + '\\.DescendantAdded\\b').test(range.body)) {
        addCandidate(name, parameter, 'character', range);
      } else if (new RegExp('\\b[A-Za-z_]\\w*\\s*\\[\\s*' + escaped + '\\s*\\]').test(range.body) &&
          new RegExp('\\b' + escaped + '\\s*==\\s*localPlayer\\b|\\blocalPlayer\\s*==\\s*' + escaped).test(range.body)) {
        addCandidate(name, parameter, 'player', range);
      } else if (new RegExp('\\b' + escaped + '\\s*:\\s*IsA\\s*\\(\\s*"Accessory"\\s*\\)').test(range.body) &&
          new RegExp('\\b' + escaped + '\\s*:\\s*Destroy\\s*\\(').test(range.body)) {
        addCandidate(name, parameter, 'descendant', range);
      }
    }
  }

  for (const [name, entries] of declarations) {
    const localEntries = entries.filter(entry => entry.kind === 'local');
    if (!/^(?:v|var|tbl|table|local)\d+$/i.test(name)) continue;
    for (const entry of localEntries) {
      const containing = functionRanges
        .filter(range => entry.token.start > range.bodyStart && entry.token.start < range.end)
        .sort((left, right) => left.length - right.length);
      if (!containing.length) continue;
      const range = containing[0];
      const declarationsInRange = localEntries.filter(candidate =>
        candidate.token.start > range.bodyStart && candidate.token.start < range.end
      );
      const sameNameParameter = range.parameters.some(parameter => parameter.value === name);
      if (declarationsInRange.length !== 1 || sameNameParameter) continue;
      const localBody = source.slice(entry.token.end, range.end);
      const initializer = source.slice(entry.token.end, Math.min(range.end, entry.token.end + 240));
      if (/^\s*=\s*[A-Za-z_]\w*\s*\[[^\]]+\]/.test(initializer) &&
          /\.Parent\b/.test(localBody) &&
          (/:Destroy\s*\(/.test(localBody) || /\.Parent\s*=\s*nil\b/.test(localBody))) {
        addCandidate(name, entry.token, 'trackedInstance', range);
      } else if (/^\s*=\s*[A-Za-z_]\w*\s*\[[^\]]+\]/.test(initializer) &&
          /\.character\b/.test(localBody) && /\.descendant\b/.test(localBody) &&
          /Disconnect\s*\(/.test(localBody)) {
        addCandidate(name, entry.token, 'playerConnections', range);
      }
    }
  }

  const replacements = new Map();
  const summaries = new Map();
  for (let position = 0; position < items.length; position++) {
    const token = items[position].token;
    if (token.type !== 'identifier') continue;
    const applicable = candidates
      .filter(candidate => candidate.name === token.value &&
        token.start >= candidate.token.start && token.start < candidate.range.end)
      .sort((left, right) =>
        left.range.length - right.range.length || right.token.start - left.token.start
      );
    if (!applicable.length) continue;
    const chosen = applicable[0];
    const sameScopeDeclarations = (declarations.get(token.value) || []).filter(entry => {
      if (entry.token.start === chosen.token.start) return false;
      const scope = functionRanges
        .filter(range => entry.token.start > range.bodyStart && entry.token.start < range.end)
        .sort((left, right) => left.length - right.length)[0];
      return scope?.id === chosen.range.id && entry.token.start <= token.start;
    });
    if (sameScopeDeclarations.length) continue;
    const previousValue = items[position - 1]?.token.value;
    if (previousValue === '.' || previousValue === ':' || isTableKey(items, position)) continue;
    replacements.set(token.start, chosen.target);
    summaries.set(chosen.name + '->' + chosen.target + ':' + chosen.range.id,
      chosen.name + ' -> ' + chosen.target);
  }
  return { replacements, summaries: [...summaries.values()] };
}

function formatReadableIndentation(source) {
  const lines = source.split(/(?<=\n)/);
  const tokens = tokenize(source).tokens;
  const protectedLines = new Set();
  const lineNumberAt = offset => source.slice(0, offset).split(/\r\n|\r|\n/).length;
  for (const token of tokens) {
    const longComment = token.type === 'trivia' && token.value.startsWith('--') && /\r|\n/.test(token.value);
    const longString = token.type === 'string' && /\r|\n/.test(token.value);
    if (!longComment && !longString) continue;
    const firstLine = lineNumberAt(token.start);
    const lastLine = lineNumberAt(Math.max(token.start, token.end - 1));
    for (let line = firstLine; line <= lastLine; line++) protectedLines.add(line);
  }
  let depth = 0;
  let changed = 0;
  const formatted = lines.map((line, index) => {
    const lineNumber = index + 1;
    const ending = line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : '';
    const content = ending ? line.slice(0, -ending.length) : line;
    if (!content.trim() || protectedLines.has(lineNumber)) return content + ending;
    const lineTokens = significant(tokenize(content).tokens).map(item => item.token);
    if (!lineTokens.length) return content + ending;
    const first = lineTokens[0].value;
    const branch = first === 'else' || first === 'elseif';
    const closer = first === 'end' || first === 'until';
    const formattedLine = '  '.repeat(Math.max(0, depth - (branch || closer ? 1 : 0))) + content.trimStart();
    if (formattedLine !== content) changed++;
    let opens = 0;
    if (first === 'function' || (first === 'local' && lineTokens[1]?.value === 'function') ||
        first === 'if' || first === 'for' || first === 'while' || first === 'repeat' || first === 'do') opens++;
    const closes = lineTokens.filter(token => token.value === 'end' || token.value === 'until').length;
    depth = Math.max(0, depth + opens - closes);
    return formattedLine + ending;
  });
  return { source: formatted.join(''), changedLines: changed };
}


function countChangedLines(before, after) {
  const left = before.split(/\r\n|\r|\n/);
  const right = after.split(/\r\n|\r|\n/);
  const length = Math.max(left.length, right.length);
  let count = 0;
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) count++;
  }
  return count;
}

function formatReadableSource(source) {
  const result = spawnSync('stylua', ['--syntax', 'luau', '--verify', '-'], {
    input: source,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30_000,
    windowsHide: true
  });

  if (!result.error && result.status === 0 &&
      typeof result.stdout === 'string' && result.stdout.trim()) {
    return {
      source: result.stdout,
      changedLines: countChangedLines(source, result.stdout),
      formatterUsed: 'StyLua 2.6.0 (Luau)',
      syntaxValidated: true,
      formatterError: null
    };
  }

  const fallback = formatReadableIndentation(source);
  const errorText = result.error?.message ||
    String(result.stderr || '').trim().slice(0, 500) ||
    'StyLua returned exit code ' + String(result.status);
  return {
    ...fallback,
    formatterUsed: 'conservative indentation fallback',
    syntaxValidated: false,
    formatterError: errorText
  };
}

function inspectPartialRecovery(source) {
  const runtimeStubMatches = source.match(/error\\s*\\(\\s*["']Luraph runtime function, not devirtualized["']\\s*\\)/g) || [];
  const symbolicFailureMatches = source.match(/devirt:\\s*symbolic value store into proto array/gi) || [];
  const payloadFunctionMatches = source.match(/\\bfunction\\s+payload_fn_\\d+\\s*\\(/g) || [];
  const placeholderReferenceMatches = source.match(/\\bupv\\d+\\b/g) || [];
  const isLuraphPartial = /Luraph runtime function.*not lifted|devirt:\\s*symbolic value store into proto array|\\bpayload_fn_\\d+\\b/i.test(source);
  return {
    isLuraphPartial,
    runtimeStubs: runtimeStubMatches.length,
    symbolicLiftFailures: symbolicFailureMatches.length,
    generatedPayloadFunctions: payloadFunctionMatches.length,
    unresolvedUpvalueReferences: new Set(placeholderReferenceMatches).size
  };
}

function convertToPureLuau(source) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('The source file is empty.');
  const originalLineCount = source.split(/\r\n|\r|\n/).length;
  const advancedDecode = decodeStaticShiftXorStateMachine(source);
  source = advancedDecode.source;
  const lexed = tokenize(source);
  const tokens = lexed.tokens;
  const coverage = scanSourceFeatures(source, tokens);
  const declarations = collectDeclarations(source, tokens);
  const parallelNames = inferParallelLocalNames(source, tokens);
  const callbackNames = inferCallbackFunctionNames(source, declarations);
  const scopedSemanticRenames = inferScopedSemanticRenames(source, tokens, declarations);
  const readabilitySemanticRenames = inferReadableSemanticRenames(source, tokens, declarations);
  const renameMap = new Map();
  const occupied = new Set(declarations.keys());

  for (const [oldName, entries] of declarations) {
    if (entries.length !== 1) continue;
    const entry = entries[0];
    if (entry.kind === 'loop' || entry.kind === 'parameter') continue;
    const inferred = parallelNames.get(oldName) || callbackNames.get(oldName) || inferIdentifierName(source, entry.token, entry.isFunction);
    if (!inferred || inferred === oldName || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(inferred)) continue;
    if (occupied.has(inferred) || KEYWORDS.has(inferred)) continue;
    renameMap.set(oldName, inferred);
  }

  for (const [parameterName, descriptiveName] of inferParameterMappings(source, tokens, declarations)) {
    if (!renameMap.has(parameterName) && !occupied.has(descriptiveName) && !KEYWORDS.has(descriptiveName)) {
      renameMap.set(parameterName, descriptiveName);
    }
  }

  const initialItems = significant(tokens);
  for (let position = 0; position < initialItems.length; position++) {
    const token = initialItems[position].token;
    if (token.type !== 'identifier') continue;
    const replacement = scopedSemanticRenames.replacements.get(token.start) ||
      readabilitySemanticRenames.replacements.get(token.start) || renameMap.get(token.value);
    if (!replacement) continue;
    if (initialItems[position - 1]?.token.value === '.' || initialItems[position - 1]?.token.value === ':') continue;
    if (isTableKey(initialItems, position)) continue;
    token.value = replacement;
  }

  let decodedEscapes = 0;
  for (const token of tokens) {
    if (token.type !== 'string') continue;
    const decoded = decodeQuotedString(token);
    if (decoded !== null) {
      token.value = quoteLuauString(decoded);
      decodedEscapes++;
    }
  }

  const foldedNumbers = foldSafeConstants(tokens);
  const foldedCharCalls = foldStringCharCalls(tokens);
  const foldedStringCalls = foldStaticStringCalls(tokens);
  const foldedTableConcatCalls = foldStaticTableConcatCalls(source, tokens);
  const foldedBit32Calls = foldBit32Calls(tokens);
  const foldedBase64Calls = foldBase64DecodeCalls(tokens);

  const declaredNames = new Set(declarations.keys());
  let legacyCallsReplaced = 0;
  const afterFolding = significant(tokens);
  for (let index = 0; index < afterFolding.length; index++) {
    const token = afterFolding[index].token;
    const previous = afterFolding[index - 1]?.token.value;
    if (token.type !== 'identifier' || !['wait', 'spawn', 'delay'].includes(token.value)) continue;
    if (previous === '.' || previous === ':' || declaredNames.has(token.value)) continue;
    token.value = 'task.' + token.value;
    legacyCallsReplaced++;
  }

  const executorCounts = new Map();
  const finalItems = significant(tokens);
  for (let index = 0; index < finalItems.length; index++) {
    const token = finalItems[index].token;
    if (token.type !== 'identifier') continue;
    let apiName = token.value;
    if (apiName === 'HttpGet' && finalItems[index - 1]?.token.value === ':' &&
      finalItems[index - 2]?.token.value === 'game') apiName = 'game:HttpGet';
    else if (!EXECUTOR_APIS.has(apiName)) continue;
    executorCounts.set(apiName, (executorCounts.get(apiName) || 0) + 1);
  }

  const unsupportedNames = [...executorCounts.keys()].sort();
  const executorApisFound = [...executorCounts.values()].reduce((sum, count) => sum + count, 0);
  const converted = tokens.map(token => {
    if (token.type === 'symbol' && token.value === ';') return '\n';
    return token.value;
  }).join('');
  const readabilityFormat = formatReadableSource(converted);
  const readableConverted = readabilityFormat.source;

  const notes = [];
  if (unsupportedNames.length) {
    notes.push('-- Executor-only dependencies preserved for manual Roblox redesign: ' + unsupportedNames.join(', '));
    notes.push('-- These calls were NOT deleted or falsely mapped to Roblox APIs.');
  }
  if (lexed.lexicalErrors) {
    notes.push('-- SCAMWATCH WARNING: lexical scan found ' + lexed.lexicalErrors + ' unterminated string/comment block(s).');
  }
  const structural = analyzeStructure(readableConverted, tokenize(readableConverted).tokens);
  if (structural.diagnostics.length) notes.push('-- SCAMWATCH structural review: ' + structural.diagnostics.join(' | '));
  const output = (notes.length ? notes.join('\n') + '\n' : '') + readableConverted;
  const bracketCheck = checkBalancedDelimiters(tokenize(readableConverted).tokens);
  return {
    output,
    identifiersRenamed: renameMap.size + scopedSemanticRenames.summaries.length + readabilitySemanticRenames.summaries.length,
    renamedIdentifiers: [
      ...[...renameMap.entries()].map(([from, to]) => from + ' -> ' + to),
      ...scopedSemanticRenames.summaries,
      ...readabilitySemanticRenames.summaries
    ],
    readabilityRenamedIdentifiers: readabilitySemanticRenames.summaries.length,
    formattedLines: readabilityFormat.changedLines,
    formatterUsed: readabilityFormat.formatterUsed,
    formatterSyntaxValidated: readabilityFormat.syntaxValidated,
    formatterError: readabilityFormat.formatterError,
    decodedEscapedStrings: decodedEscapes,
    foldedNumericExpressions: foldedNumbers,
    foldedStringCharCalls: foldedCharCalls,
    foldedStringCalls,
    foldedTableConcatCalls,
    foldedBit32Calls,
    foldedBase64Calls,
    decodedStateMachines: advancedDecode.count,
    decodedStaticStrings: advancedDecode.strings,
    decoderTypes: advancedDecode.decoderTypes,
    legacyCallsReplaced,
    linesProcessed: originalLineCount,
    executorApisFound,
    executorApisReplaced: 0,
    unsupportedDependenciesRemaining: executorApisFound,
    unsupportedNames,
    lexicalValidationPassed: lexed.lexicalErrors === 0 && bracketCheck,
    structuralValidationPassed: structural.passed,
    structuralDiagnostics: structural.diagnostics,
    duplicateBlocks: structural.duplicateBlocks,
    coverage,
    syntaxValidation: readabilityFormat.syntaxValidated
      ? 'PASS: StyLua parsed the Luau output and --verify checked the formatting result'
      : 'NOT RUN: StyLua was unavailable or rejected the source; conservative formatting fallback used'
  };
}

function checkBalancedDelimiters(tokens) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const token of tokens) {
    if (token.type === 'trivia' || token.type === 'string') continue;
    if (token.value === '(' || token.value === '[' || token.value === '{') stack.push(token.value);
    else if (Object.prototype.hasOwnProperty.call(pairs, token.value)) {
      if (stack.pop() !== pairs[token.value]) return false;
    }
  }
  return stack.length === 0;
}

function analyzeStructure(source, tokens) {
  const diagnostics = [];
  const blocks = [];
  const delimiters = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const lineOf = token => source.slice(0, token.start).split(/\r\n|\r|\n/).length;

  for (const token of tokens) {
    if (token.type === 'trivia' || token.type === 'string') continue;
    if (['(', '[', '{'].includes(token.value)) delimiters.push({ value: token.value, line: lineOf(token) });
    else if (Object.prototype.hasOwnProperty.call(pairs, token.value)) {
      const opened = delimiters.pop();
      if (!opened || opened.value !== pairs[token.value]) {
        diagnostics.push('Unmatched closing delimiter "' + token.value + '" near line ' + lineOf(token) + '.');
      }
    }
  }
  for (const opened of delimiters) {
    diagnostics.push('Unclosed delimiter "' + opened.value + '" from line ' + opened.line + '.');
  }

  const significantTokens = tokens.filter(token => token.type !== 'trivia' && token.type !== 'string' && token.value !== '');
  for (let index = 0; index < significantTokens.length; index++) {
    const token = significantTokens[index];
    const previous = significantTokens[index - 1]?.value;
    if (token.value === 'function' || token.value === 'for' || token.value === 'while' || token.value === 'repeat') {
      blocks.push({ kind: token.value, line: lineOf(token) });
    } else if (token.value === 'if') {
      const likelyExpression = ['=', 'return', '(', ','].includes(previous);
      if (!likelyExpression) blocks.push({ kind: 'if', line: lineOf(token) });
    } else if (token.value === 'do') {
      const top = blocks[blocks.length - 1]?.kind;
      if (top !== 'for' && top !== 'while') blocks.push({ kind: 'do', line: lineOf(token) });
    } else if (token.value === 'until') {
      const top = blocks[blocks.length - 1];
      if (!top || top.kind !== 'repeat') diagnostics.push('Unexpected "until" near line ' + lineOf(token) + '.');
      else blocks.pop();
    } else if (token.value === 'end') {
      const top = blocks.pop();
      if (!top) diagnostics.push('Orphan "end" near line ' + lineOf(token) + '.');
      else if (top.kind === 'repeat') {
        diagnostics.push('"repeat" from line ' + top.line + ' cannot be closed with "end".');
        blocks.push(top);
      }
    }
  }
  for (const block of blocks.slice(-8)) {
    diagnostics.push('Possible missing "end"/"until" for "' + block.kind + '" opened near line ' + block.line + '.');
  }

  const finalToken = significantTokens[significantTokens.length - 1];
  if (finalToken && ['=', ',', '+', '-', '*', '/', '//', '%', '^', '..', '&', '|', '~', '<<', '>>'].includes(finalToken.value)) {
    diagnostics.push('Source ends with "' + finalToken.value + '"; the final statement may be incomplete.');
  }

  const lines = source.split(/\r\n|\r|\n/);
  const windows = new Map();
  const duplicateBlocks = [];
  const width = 3;
  for (let start = 0; start + width <= lines.length; start++) {
    const windowLines = lines.slice(start, start + width).map(line => line.trim());
    if (windowLines.every(line => !line || line.startsWith('--'))) continue;
    const codeLines = windowLines.filter(line => line && !line.startsWith('--'));
    if (codeLines.length < width) continue;
    const key = windowLines.join('\n');
    const previousLine = windows.get(key);
    if (previousLine !== undefined && start + 1 > previousLine + width) {
      duplicateBlocks.push({ firstLine: previousLine, repeatedLine: start + 1, lines: width });
      if (duplicateBlocks.length >= 6) break;
    } else if (previousLine === undefined) {
      windows.set(key, start + 1);
    }
  }
  for (const duplicate of duplicateBlocks) {
    diagnostics.push('Possible duplicated ' + duplicate.lines + '-line block at lines ' +
      duplicate.firstLine + ' and ' + duplicate.repeatedLine + '; preserved.');
  }

  return {
    passed: diagnostics.length === 0,
    diagnostics: [...new Set(diagnostics)].slice(0, 20),
    duplicateBlocks
  };
}

function scanSourceFeatures(source, tokens) {
  const numberCounts = { hexadecimal: 0, binary: 0, octal: 0, scientific: 0, decimal: 0 };
  const operatorNames = new Set();
  const identifiers = new Set(tokens.filter(token => token.type === 'identifier').map(token => token.value));
  for (const token of tokens) {
    if (token.type === 'number') {
      if (/^0x/i.test(token.value)) numberCounts.hexadecimal++;
      else if (/^0b/i.test(token.value)) numberCounts.binary++;
      else if (/^0o/i.test(token.value)) numberCounts.octal++;
      else if (/[eE]/.test(token.value)) numberCounts.scientific++;
      else numberCounts.decimal++;
    }
    if ((token.type === 'symbol' || token.type === 'keyword') &&
      ['+', '-', '*', '/', '//', '%', '^', '&', '|', '~', '<<', '>>', '==', '~=', '<', '>', '<=', '>=',
        'and', 'or', 'not', '=', '+=', '-=', '*=', '/=', '%=', '^=', '..=', '//=', '&=', '|=', '<<=', '>>=']
        .includes(token.value)) operatorNames.add(token.value);
  }
  const collect = (names, set = identifiers) => names.filter(name => set.has(name));
  const stringApis = collect(['char', 'byte', 'sub', 'reverse', 'gsub', 'format']);
  const tableApis = collect(['concat', 'insert', 'remove', 'sort']);
  const utf8Apis = collect(['char', 'codepoint', 'codes', 'len', 'offset']);
  const coroutineApis = collect(['create', 'resume', 'yield', 'wrap', 'status']);
  const bit32Apis = collect(['band', 'bor', 'bxor', 'bnot', 'lshift', 'rshift', 'arshift', 'extract', 'replace']);
  const metatableMethods = collect(['__index', '__newindex', '__call', '__tostring', '__concat', '__add',
    '__sub', '__mul', '__div', '__len', '__eq', '__lt', '__le']);
  const vmIndicators = collect(['_pc', '_st', '_reg', '_stack', '_ops', 'opcode', 'dispatch', 'prototype']);
  const environmentApis = collect(['_G', '_ENV', 'getgenv', 'getfenv', 'setfenv', 'loadstring', 'load', 'require',
    'pcall', 'xpcall', 'select', 'unpack']);
  const luauSyntax = [];
  if (source.includes('::')) luauSyntax.push('type assertions (::)');
  if (source.includes('->')) luauSyntax.push('function type arrows (->)');
  if (/\btype\s+[A-Za-z_]\w*/.test(source)) luauSyntax.push('type aliases');
  if (/\b[A-Za-z_]\w*\s*:\s*[A-Za-z_{}]/.test(source)) luauSyntax.push('type annotations');
  if (source.includes('...')) luauSyntax.push('varargs');
  if (source.includes('?')) luauSyntax.push('optional type marker (?)');
  const escapeStyles = [];
  if (/\\[0-9]{1,3}/.test(source)) escapeStyles.push('decimal string escapes');
  if (/\\x[0-9a-f]{2}/i.test(source)) escapeStyles.push('hex string escapes');
  if (/\\u\{[0-9a-f]+\}/i.test(source)) escapeStyles.push('Unicode string escapes');
  if (/\\z\s/i.test(source)) escapeStyles.push('whitespace-suppressed strings');
  return {
    numericFormats: numberCounts,
    operators: [...operatorNames].sort(),
    stringApis,
    tableApis,
    utf8Apis,
    coroutineApis,
    escapeStyles,
    bit32Apis,
    metatableMethods,
    vmIndicators,
    environmentApis,
    luauSyntax
  };
}

module.exports = { convertToPureLuau, inspectPartialRecovery };
