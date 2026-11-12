import type { Program } from "./ast";

const luauParser = require("luau-parser") as {
  parse: (source: string, options?: { syntax?: "luau" | "lua51" }) => any;
};

const SUPPORTED_BINARY_OPERATORS = new Set([
  "and", "or", "+", "-", "*", "/", "//", "%", "^", "..",
  "==", "~=", "<", "<=", ">", ">=", "&", "|", "~", "<<", ">>",
]);
const SUPPORTED_UNARY_OPERATORS = new Set(["-", "not", "#", "~"]);

type ConversionContext = {
  source: string;
  nextTemporary: number;
};

export class Parser {
  constructor(private readonly source: string) {}

  parse(): Program {
    const source = this.source.replace(/^\uFEFF/, "");
    let parsed: any;

    try {
      parsed = luauParser.parse(source, { syntax: "luau" });
    } catch (error: any) {
      const line = Number(error && error.line) || 0;
      const column = Number(error && error.column) || 0;
      const lines = source.split(/\r?\n/);
      const sourceLine = line > 0 && line <= lines.length ? lines[line - 1] : "";
      const excerpt = sourceLine
        ? "\n" + sourceLine.slice(0, 220) +
          (sourceLine.length > 220 ? " ..." : "") +
          (column > 0 ? "\n" + " ".repeat(Math.min(column - 1, 80)) + "^" : "")
        : "";
      const where = line ? " at line " + line + (column ? ", column " + column : "") : "";
      throw new Error("IronVeil Luau parser rejected the source" + where + ": " +
        String(error && error.message || error).slice(0, 240) + excerpt);
    }

    if (!parsed || parsed.type !== "Program" ||
        !parsed.body || !Array.isArray(parsed.body.statements)) {
      throw new Error("IronVeil Luau parser returned an invalid program.");
    }

    const context: ConversionContext = { source, nextTemporary: 0 };
    const legacyBody = convertLuauBlock(parsed.body, context);
    return {
      type: "Program",
      body: legacyBody.flatMap((node: any) => convertStatement(node)),
    } as Program;
  }
}

function block(body: any[]): any {
  return {
    type: "Block",
    body: body.flatMap((node) => convertStatement(node)),
  };
}

function legacyIdentifier(name: string): any {
  return { type: "Identifier", name: String(name) };
}

function typedIdentifier(node: any): any {
  if (!node || typeof node.name !== "string") {
    throw new Error("IronVeil encountered an invalid Luau identifier.");
  }
  return legacyIdentifier(node.name);
}

function functionParameters(func: any): any[] {
  const parameters = Array.isArray(func && func.params)
    ? func.params.map((parameter: any) => legacyIdentifier(parameter.name))
    : [];
  if (func && func.hasVarargs) parameters.push({ type: "VarargLiteral" });
  return parameters;
}

function legacyFunctionNode(
  func: any,
  identifier: any = null,
  isLocal = false,
  isMethod: boolean,
  context: ConversionContext,
): any {
  return {
    type: "FunctionDeclaration",
    identifier,
    isLocal,
    isMethod,
    parameters: functionParameters(func),
    body: convertLuauBlock(func && func.body, context),
  };
}

function convertLuauBlock(node: any, context: ConversionContext): any[] {
  if (!node || !Array.isArray(node.statements)) return [];
  return node.statements.flatMap((statement: any) =>
    convertLuauStatement(statement, context)
  );
}

function nextTemporary(context: ConversionContext): any {
  let name = "";
  do {
    name = "__ironveil_compound_" + context.nextTemporary++;
  } while (context.source.includes(name));
  return legacyIdentifier(name);
}

function cloneLegacyExpression(node: any): any {
  if (!node) return node;
  if (Array.isArray(node)) return node.map(cloneLegacyExpression);
  if (typeof node !== "object") return node;
  const copy: any = {};
  for (const [key, value] of Object.entries(node)) {
    copy[key] = cloneLegacyExpression(value);
  }
  return copy;
}

function lowerCompoundAssignment(node: any, context: ConversionContext): any[] {
  const operators: Record<string, string> = {
    "+=": "+",
    "-=": "-",
    "*=": "*",
    "/=": "/",
    "//=": "//",
    "%=": "%",
    "^=": "^",
    "..=": "..",
  };
  const operator = operators[String(node.operator)];
  if (!operator) {
    throw new Error("IronVeil does not support compound operator " + String(node.operator) + ".");
  }

  const target = node.target;
  let legacyTarget: any;
  const prefix: any[] = [];

  if (target && target.type === "Identifier") {
    legacyTarget = legacyIdentifier(target.name);
  } else if (target && target.type === "MemberExpression") {
    const baseTemporary = nextTemporary(context);
    prefix.push({
      type: "LocalStatement",
      variables: [baseTemporary],
      init: [convertLuauExpression(target.object, context)],
    });
    legacyTarget = {
      type: "MemberExpression",
      base: cloneLegacyExpression(baseTemporary),
      indexer: ".",
      identifier: legacyIdentifier(target.property && target.property.name),
      computed: false,
    };
  } else if (target && target.type === "IndexExpression") {
    const baseTemporary = nextTemporary(context);
    const indexTemporary = nextTemporary(context);
    prefix.push({
      type: "LocalStatement",
      variables: [baseTemporary],
      init: [convertLuauExpression(target.object, context)],
    });
    prefix.push({
      type: "LocalStatement",
      variables: [indexTemporary],
      init: [convertLuauExpression(target.index, context)],
    });
    legacyTarget = {
      type: "IndexExpression",
      base: cloneLegacyExpression(baseTemporary),
      index: cloneLegacyExpression(indexTemporary),
    };
  } else {
    throw new Error(
      "IronVeil cannot safely lower this compound-assignment target (" +
      String(target && target.type || "unknown") + ")."
    );
  }

  prefix.push({
    type: "AssignmentStatement",
    variables: [legacyTarget],
    init: [{
      type: "BinaryExpression",
      operator,
      left: cloneLegacyExpression(legacyTarget),
      right: convertLuauExpression(node.value, context),
    }],
  });
  return prefix;
}

function convertLuauStatement(node: any, context: ConversionContext): any[] {
  if (!node || typeof node.type !== "string") {
    throw new Error("IronVeil encountered an invalid Luau statement.");
  }

  switch (node.type) {
    case "LocalStatement":
      return [{
        type: "LocalStatement",
        variables: (node.names || []).map(typedIdentifier),
        init: (node.init || []).map((value: any) => convertLuauExpression(value, context)),
      }];

    case "LocalFunctionStatement":
      return [legacyFunctionNode(node.func, typedIdentifier(node.name), true, false, context)];

    case "FunctionDeclarationStatement": {
      const target = node.target;
      if (!target || !target.base) {
        throw new Error("IronVeil encountered an invalid function declaration target.");
      }
      let identifier: any = typedIdentifier(target.base);
      for (const item of target.path || []) {
        identifier = {
          type: "MemberExpression",
          base: identifier,
          indexer: ".",
          identifier: typedIdentifier(item),
          computed: false,
        };
      }
      const isMethod = Boolean(target.method);
      if (isMethod) {
        identifier = {
          type: "MemberExpression",
          base: identifier,
          indexer: ":",
          identifier: typedIdentifier(target.method),
          computed: false,
        };
      }
      return [legacyFunctionNode(node.func, identifier, false, isMethod, context)];
    }

    case "AssignmentStatement":
      return [{
        type: "AssignmentStatement",
        variables: (node.targets || []).map((target: any) => convertLuauExpression(target, context)),
        init: (node.values || []).map((value: any) => convertLuauExpression(value, context)),
      }];

    case "CompoundAssignmentStatement":
      return lowerCompoundAssignment(node, context);

    case "CallStatement":
      return [{
        type: "CallStatement",
        expression: convertLuauExpression(node.expression, context),
      }];

    case "DoStatement":
      return [{ type: "DoStatement", body: convertLuauBlock(node.body, context) }];

    case "WhileStatement":
      return [{
        type: "WhileStatement",
        condition: convertLuauExpression(node.condition, context),
        body: convertLuauBlock(node.body, context),
      }];

    case "RepeatStatement":
      return [{
        type: "RepeatStatement",
        body: convertLuauBlock(node.body, context),
        condition: convertLuauExpression(node.condition, context),
      }];

    case "IfStatement": {
      const clauses = (node.clauses || []).map((clause: any) => ({
        type: "IfClause",
        condition: convertLuauExpression(clause.condition, context),
        body: convertLuauBlock(clause.body, context),
      }));
      return [{
        type: "IfStatement",
        clauses,
        elseBody: node.alternate ? convertLuauBlock(node.alternate, context) : null,
      }];
    }

    case "NumericForStatement":
      return [{
        type: "ForNumericStatement",
        variable: typedIdentifier(node.variable),
        start: convertLuauExpression(node.start, context),
        end: convertLuauExpression(node.end, context),
        step: node.step ? convertLuauExpression(node.step, context) : null,
        body: convertLuauBlock(node.body, context),
      }];

    case "GenericForStatement":
      return [{
        type: "ForGenericStatement",
        variables: (node.variables || []).map(typedIdentifier),
        iterators: (node.iterators || []).map((value: any) => convertLuauExpression(value, context)),
        body: convertLuauBlock(node.body, context),
      }];

    case "ReturnStatement":
      return [{
        type: "ReturnStatement",
        arguments: (node.arguments || []).map((value: any) => convertLuauExpression(value, context)),
      }];

    case "BreakStatement":
      return [{ type: "BreakStatement" }];

    case "ContinueStatement":
      return [{ type: "ContinueStatement" }];

    // Type aliases and exported type aliases have no runtime representation.
    case "TypeAliasStatement":
    case "ExportTypeAliasStatement":
      return [];

    default:
      throw new Error('IronVeil does not support Luau statement type "' + node.type + '".');
  }
}

function convertLuauExpression(node: any, context: ConversionContext): any {
  if (!node || typeof node.type !== "string") {
    throw new Error("IronVeil encountered an invalid Luau expression.");
  }

  switch (node.type) {
    case "Identifier":
      return legacyIdentifier(node.name);

    case "NilLiteral":
      return { type: "NilLiteral" };

    case "BooleanLiteral":
      return { type: "BooleanLiteral", value: Boolean(node.value) };

    case "NumberLiteral":
      return { type: "NumericLiteral", value: Number(node.value), raw: String(node.raw ?? node.value) };

    case "StringLiteral":
      return { type: "StringLiteral", value: String(node.value), raw: String(node.raw || JSON.stringify(node.value)) };

    case "VarargExpression":
      return { type: "VarargLiteral" };

    case "ParenthesizedExpression":
      return convertLuauExpression(node.expression, context);

    // Luau type assertions do not change runtime values.
    case "TypeAssertionExpression":
      return convertLuauExpression(node.expression, context);

    case "BinaryExpression": {
      const operator = String(node.operator);
      if (!SUPPORTED_BINARY_OPERATORS.has(operator)) {
        throw new Error('IronVeil does not support binary operator "' + operator + '".');
      }
      return {
        type: "BinaryExpression",
        operator,
        left: convertLuauExpression(node.left, context),
        right: convertLuauExpression(node.right, context),
      };
    }

    case "UnaryExpression": {
      const operator = String(node.operator);
      if (!SUPPORTED_UNARY_OPERATORS.has(operator)) {
        throw new Error('IronVeil does not support unary operator "' + operator + '".');
      }
      return {
        type: "UnaryExpression",
        operator,
        argument: convertLuauExpression(node.argument, context),
      };
    }

    case "MemberExpression":
      return {
        type: "MemberExpression",
        base: convertLuauExpression(node.object, context),
        indexer: ".",
        identifier: typedIdentifier(node.property),
        computed: false,
      };

    case "IndexExpression":
      return {
        type: "IndexExpression",
        base: convertLuauExpression(node.object, context),
        index: convertLuauExpression(node.index, context),
      };

    case "CallExpression":
      return {
        type: "CallExpression",
        base: convertLuauExpression(node.callee, context),
        arguments: (node.arguments || []).map((argument: any) => convertLuauExpression(argument, context)),
      };

    case "MethodCallExpression":
      return {
        type: "CallExpression",
        base: {
          type: "MemberExpression",
          base: convertLuauExpression(node.object, context),
          indexer: ":",
          identifier: typedIdentifier(node.method),
          computed: false,
        },
        arguments: (node.arguments || []).map((argument: any) => convertLuauExpression(argument, context)),
      };

    case "TableExpression":
      return {
        type: "TableConstructorExpression",
        fields: (node.fields || []).map((field: any) => {
          if (field.type === "TableFieldPositional") {
            return { type: "TableValue", value: convertLuauExpression(field.value, context) };
          }
          if (field.type === "TableFieldNamed") {
            return {
              type: "TableKeyString",
              key: typedIdentifier(field.name),
              value: convertLuauExpression(field.value, context),
            };
          }
          if (field.type === "TableFieldComputed") {
            return {
              type: "TableKey",
              key: convertLuauExpression(field.key, context),
              value: convertLuauExpression(field.value, context),
            };
          }
          throw new Error('IronVeil does not support Luau table field type "' + String(field.type) + '".');
        }),
      };

    case "FunctionExpression":
      return legacyFunctionNode(node.func, null, false, false, context);

    case "InterpolatedStringExpression": {
      const parts = (node.parts || []).map((part: any) => {
        if (part.kind === "string") {
          return {
            type: "StringLiteral",
            value: String(part.value),
            raw: String(part.raw || JSON.stringify(part.value)),
          };
        }
        if (part.kind === "expression") {
          return {
            type: "CallExpression",
            base: legacyIdentifier("tostring"),
            arguments: [convertLuauExpression(part.expression, context)],
          };
        }
        throw new Error("IronVeil encountered an invalid interpolated-string part.");
      });
      if (parts.length === 0) return { type: "StringLiteral", value: "", raw: '""' };
      return parts.slice(1).reduce((left: any, right: any) => ({
        type: "BinaryExpression",
        operator: "..",
        left,
        right,
      }), parts[0]);
    }

    case "IfElseExpression": {
      const clauses = (node.clauses || []).map((clause: any) => ({
        type: "IfClause",
        condition: convertLuauExpression(clause.condition, context),
        body: [{
          type: "ReturnStatement",
          arguments: [convertLuauExpression(clause.body, context)],
        }],
      }));
      const functionNode = {
        type: "FunctionDeclaration",
        identifier: null,
        isLocal: false,
        isMethod: false,
        parameters: [],
        body: [{
          type: "IfStatement",
          clauses,
          elseBody: [{
            type: "ReturnStatement",
            arguments: [convertLuauExpression(node.alternate, context)],
          }],
        }],
      };
      return { type: "CallExpression", base: functionNode, arguments: [] };
    }

    default:
      throw new Error('IronVeil does not support Luau expression type "' + node.type + '".');
  }
}

function convertFunction(node: any, asExpression: boolean): any {
  const parameters = Array.isArray(node.parameters)
    ? node.parameters.map((parameter: any) => {
        if (parameter && parameter.type === "VarargLiteral") return { type: "Identifier", name: "..." };
        return convertIdentifier(parameter);
      })
    : [];
  if (node.isMethod) parameters.unshift({ type: "Identifier", name: "self" });
  const body = block(Array.isArray(node.body) ? node.body : []);
  if (asExpression || node.identifier == null) {
    return { type: "FunctionExpression", parameters, body };
  }
  return {
    type: "FunctionDeclaration",
    identifier: convertLValue(node.identifier),
    isLocal: Boolean(node.isLocal),
    parameters,
    body,
  };
}

function convertIdentifier(node: any): any {
  if (!node || node.type !== "Identifier" || typeof node.name !== "string") {
    throw new Error("IronVeil encountered an invalid identifier node.");
  }
  return { type: "Identifier", name: node.name };
}

function convertLValue(node: any): any {
  if (!node) throw new Error("IronVeil encountered an empty assignment target.");
  if (node.type === "Identifier") return convertIdentifier(node);
  if (node.type === "MemberExpression" || node.type === "IndexExpression") return convertExpression(node);
  throw new Error("IronVeil does not support this assignment target (" + String(node.type) + ").");
}

function convertExpression(node: any): any {
  if (!node || typeof node.type !== "string") {
    throw new Error("IronVeil encountered an invalid expression.");
  }
  switch (node.type) {
    case "Identifier":
      return convertIdentifier(node);
    case "StringLiteral":
      return { type: "StringLiteral", value: String(node.value), raw: String(node.raw || JSON.stringify(node.value)) };
    case "NumericLiteral":
      return { type: "NumberLiteral", value: Number(node.value), raw: String(node.raw ?? node.value) };
    case "BooleanLiteral":
      return { type: "BooleanLiteral", value: Boolean(node.value) };
    case "NilLiteral":
      return { type: "NilLiteral" };
    case "VarargLiteral":
      return { type: "VarargLiteral" };
    case "UnaryExpression": {
      const operator = String(node.operator);
      if (!SUPPORTED_UNARY_OPERATORS.has(operator)) {
        throw new Error('IronVeil does not support unary operator "' + operator + '".');
      }
      return { type: "UnaryExpression", operator, argument: convertExpression(node.argument) };
    }
    case "BinaryExpression":
    case "LogicalExpression": {
      const operator = String(node.operator);
      if (!SUPPORTED_BINARY_OPERATORS.has(operator)) {
        throw new Error('IronVeil does not support binary operator "' + operator + '" yet.');
      }
      return {
        type: "BinaryExpression",
        operator,
        left: convertExpression(node.left),
        right: convertExpression(node.right),
      };
    }
    case "MemberExpression":
      return {
        type: "MemberExpression",
        base: convertExpression(node.base),
        indexer: String(node.indexer || "."),
        identifier: convertIdentifier(node.identifier),
        computed: false,
      };
    case "IndexExpression":
      return {
        type: "MemberExpression",
        base: convertExpression(node.base),
        indexer: convertExpression(node.index),
        identifier: { type: "Identifier", name: "" },
        computed: true,
      };
    case "CallExpression":
    case "TableCallExpression":
      return {
        type: "CallExpression",
        base: convertExpression(node.base),
        arguments: Array.isArray(node.arguments) ? node.arguments.map((arg: any) => convertExpression(arg)) : [],
        selfCall: Boolean(node.base && node.base.type === "MemberExpression" && node.base.indexer === ":"),
      };
    case "StringCallExpression":
      return {
        type: "CallExpression",
        base: convertExpression(node.base),
        arguments: [convertExpression(node.argument)],
        selfCall: Boolean(node.base && node.base.type === "MemberExpression" && node.base.indexer === ":"),
      };
    case "TableConstructorExpression":
      return {
        type: "TableConstructor",
        fields: (node.fields || []).map((field: any) => {
          if (field.type === "TableValue") {
            return { type: "Array", value: convertExpression(field.value) };
          }
          if (field.type === "TableKeyString") {
            return { type: "Record", key: convertIdentifier(field.key), value: convertExpression(field.value) };
          }
          if (field.type === "TableKey") {
            return { type: "General", key: convertExpression(field.key), value: convertExpression(field.value) };
          }
          throw new Error('IronVeil does not support table field type "' + String(field.type) + '".');
        }),
      };
    case "FunctionDeclaration":
      return convertFunction(node, true);
    default:
      throw new Error('IronVeil does not support expression type "' + node.type + '".');
  }
}

function convertStatement(node: any): any[] {
  if (!node || typeof node.type !== "string") {
    throw new Error("IronVeil encountered an invalid statement.");
  }
  switch (node.type) {
    case "LocalStatement":
      return [{
        type: "LocalStatement",
        variables: (node.variables || []).map(convertIdentifier),
        init: (node.init || []).map(convertExpression),
      }];
    case "AssignmentStatement":
      return [{
        type: "AssignmentStatement",
        operator: "=",
        left: (node.variables || []).map(convertLValue),
        right: (node.init || []).map(convertExpression),
      }];
    case "CallStatement":
      return [{ type: "CallStatement", expression: convertExpression(node.expression) }];
    case "FunctionDeclaration":
      return [convertFunction(node, false)];
    case "ReturnStatement":
      return [{ type: "ReturnStatement", arguments: (node.arguments || []).map(convertExpression) }];
    case "IfStatement": {
      const clauses: any[] = [];
      let elseBody: any = null;
      for (const clause of node.clauses || []) {
        if (clause.type === "ElseClause") {
          elseBody = block(clause.body || []);
        } else if (clause.type === "IfClause" || clause.type === "ElseifClause") {
          clauses.push({ condition: convertExpression(clause.condition), body: block(clause.body || []) });
        } else {
          throw new Error('IronVeil does not support if-clause type "' + String(clause.type) + '".');
        }
      }
      return [{ type: "IfStatement", clauses, elseBody }];
    }
    case "WhileStatement":
      return [{ type: "WhileStatement", condition: convertExpression(node.condition), body: block(node.body || []) }];
    case "RepeatStatement":
      return [{ type: "RepeatStatement", body: block(node.body || []), condition: convertExpression(node.condition) }];
    case "DoStatement":
      return [{ type: "DoStatement", body: block(node.body || []) }];
    case "ForNumericStatement":
      return [{
        type: "ForStatement",
        variable: convertIdentifier(node.variable),
        start: convertExpression(node.start),
        end: convertExpression(node.end),
        step: node.step ? convertExpression(node.step) : null,
        body: block(node.body || []),
      }];
    case "ForGenericStatement":
      return [{
        type: "ForInStatement",
        variables: (node.variables || []).map(convertIdentifier),
        iterator: (node.iterators || []).map(convertExpression),
        body: block(node.body || []),
      }];
    case "BreakStatement":
      return [{ type: "BreakStatement" }];
    case "ContinueStatement":
      return [{ type: "ContinueStatement" }];
    case "LabelStatement":
    case "GotoStatement":
      throw new Error("IronVeil does not support Lua labels or goto statements.");
    default:
      throw new Error('IronVeil does not support statement type "' + node.type + '".');
  }
}
