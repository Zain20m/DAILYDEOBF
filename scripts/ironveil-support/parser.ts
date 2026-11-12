import type { Program } from "./ast";

const luaparse = require("luaparse") as { parse: (source: string, options?: Record<string, unknown>) => any };

const SUPPORTED_BINARY_OPERATORS = new Set([
  "and", "or", "+", "-", "*", "/", "%", "^", "..",
  "==", "~=", "<", "<=", ">", ">=", "&", "|", "~", "<<", ">>",
]);
const SUPPORTED_UNARY_OPERATORS = new Set(["-", "not", "#", "~"]);

export class Parser {
  constructor(private readonly source: string) {}

  parse(): Program {
    let parsed: any;
    try {
      parsed = luaparse.parse(this.source.replace(/^\uFEFF/, ""), {
        luaVersion: "5.3",
        scope: false,
        comments: false,
        locations: true,
        ranges: false,
      });
    } catch (error: any) {
      const line = Number(error && error.line) || 0;
      const column = Number(error && error.column) || 0;
      const lines = this.source.replace(/^\\uFEFF/, "").split(/\\r?\\n/);
      const sourceLine = line > 0 && line <= lines.length ? lines[line - 1] : "";
      const excerpt = sourceLine
        ? "\\n" + sourceLine.slice(0, 220) +
          (sourceLine.length > 220 ? " ..." : "") +
          (column > 0 ? "\\n" + " ".repeat(Math.min(column - 1, 80)) + "^" : "")
        : "";
      const where = line ? " at line " + line + (column ? ", column " + column : "") : "";
      throw new Error("IronVeil parser rejected the source" + where + ": " +
        String(error && error.message || error).slice(0, 240) + excerpt +
        "\\nThis parser currently accepts Lua 5.3 syntax, not the full Luau language.");
    }
    if (!parsed || !Array.isArray(parsed.body)) {
      throw new Error("IronVeil parser returned an invalid program.");
    }
    return { type: "Program", body: parsed.body.map((node: any) => convertStatement(node)) };
  }
}

function block(body: any[]): any {
  return { type: "Block", body: body.map((node) => convertStatement(node)) };
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

function convertStatement(node: any): any {
  if (!node || typeof node.type !== "string") {
    throw new Error("IronVeil encountered an invalid statement.");
  }
  switch (node.type) {
    case "LocalStatement":
      return {
        type: "LocalStatement",
        variables: (node.variables || []).map(convertIdentifier),
        init: (node.init || []).map(convertExpression),
      };
    case "AssignmentStatement":
      return {
        type: "AssignmentStatement",
        operator: "=",
        left: (node.variables || []).map(convertLValue),
        right: (node.init || []).map(convertExpression),
      };
    case "CallStatement":
      return { type: "CallStatement", expression: convertExpression(node.expression) };
    case "FunctionDeclaration":
      return convertFunction(node, false);
    case "ReturnStatement":
      return { type: "ReturnStatement", arguments: (node.arguments || []).map(convertExpression) };
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
      return { type: "IfStatement", clauses, elseBody };
    }
    case "WhileStatement":
      return { type: "WhileStatement", condition: convertExpression(node.condition), body: block(node.body || []) };
    case "RepeatStatement":
      return { type: "RepeatStatement", body: block(node.body || []), condition: convertExpression(node.condition) };
    case "DoStatement":
      return { type: "DoStatement", body: block(node.body || []) };
    case "ForNumericStatement":
      return {
        type: "ForStatement",
        variable: convertIdentifier(node.variable),
        start: convertExpression(node.start),
        end: convertExpression(node.end),
        step: node.step ? convertExpression(node.step) : null,
        body: block(node.body || []),
      };
    case "ForGenericStatement":
      return {
        type: "ForInStatement",
        variables: (node.variables || []).map(convertIdentifier),
        iterator: (node.iterators || []).map(convertExpression),
        body: block(node.body || []),
      };
    case "BreakStatement":
      return { type: "BreakStatement" };
    case "LabelStatement":
    case "GotoStatement":
      throw new Error("IronVeil does not support Lua labels or goto statements.");
    default:
      throw new Error('IronVeil does not support statement type "' + node.type + '".');
  }
}
