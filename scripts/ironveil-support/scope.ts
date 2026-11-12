import type { Program } from "./ast";

type Binding = { type: "local"; declaration: any };
type Scope = { parent: Scope | null; bindings: Map<string, any> };

function childScope(parent: Scope | null): Scope {
  return { parent, bindings: new Map<string, any>() };
}

function lookup(scope: Scope, name: string): any | null {
  for (let current: Scope | null = scope; current; current = current.parent) {
    const found = current.bindings.get(name);
    if (found) return found;
  }
  return null;
}

export class ScopeAnalyzer {
  analyze(program: Program): Program {
    const root = childScope(null);
    this.visitStatements(program.body || [], root);
    return program;
  }

  private declare(identifier: any, scope: Scope): void {
    if (!identifier || identifier.type !== "Identifier") return;
    identifier.scope = { type: "local", declaration: identifier } as Binding;
    if (identifier.name !== "...") scope.bindings.set(identifier.name, identifier);
  }

  private reference(identifier: any, scope: Scope): void {
    if (!identifier || identifier.type !== "Identifier") return;
    const declaration = lookup(scope, String(identifier.name));
    identifier.scope = declaration
      ? ({ type: "local", declaration } as Binding)
      : { type: "global" };
  }

  private visitFunction(parameters: any[], body: any, parent: Scope): void {
    const scope = childScope(parent);
    for (const parameter of parameters || []) this.declare(parameter, scope);
    this.visitBlock(body, scope, false);
  }

  private visitBlock(block: any, parent: Scope, createScope = true): void {
    const scope = createScope ? childScope(parent) : parent;
    this.visitStatements(block && block.body ? block.body : [], scope);
  }

  private visitStatements(statements: any[], scope: Scope): void {
    for (const statement of statements) this.visitStatement(statement, scope);
  }

  private visitStatement(statement: any, scope: Scope): void {
    switch (statement.type) {
      case "LocalStatement":
        for (const expression of statement.init || []) this.visitExpression(expression, scope);
        for (const variable of statement.variables || []) this.declare(variable, scope);
        break;
      case "AssignmentStatement":
        for (const target of statement.left || []) this.visitLValue(target, scope);
        for (const expression of statement.right || []) this.visitExpression(expression, scope);
        break;
      case "CallStatement":
        this.visitExpression(statement.expression, scope);
        break;
      case "FunctionDeclaration":
        if (statement.isLocal && statement.identifier && statement.identifier.type === "Identifier") {
          this.declare(statement.identifier, scope);
        } else if (statement.identifier) {
          this.visitLValue(statement.identifier, scope);
        }
        this.visitFunction(statement.parameters || [], statement.body, scope);
        break;
      case "ReturnStatement":
        for (const expression of statement.arguments || []) this.visitExpression(expression, scope);
        break;
      case "IfStatement":
        for (const clause of statement.clauses || []) {
          this.visitExpression(clause.condition, scope);
          this.visitBlock(clause.body, scope, true);
        }
        if (statement.elseBody) this.visitBlock(statement.elseBody, scope, true);
        break;
      case "WhileStatement":
        this.visitExpression(statement.condition, scope);
        this.visitBlock(statement.body, scope, true);
        break;
      case "RepeatStatement": {
        const repeatScope = childScope(scope);
        this.visitBlock(statement.body, repeatScope, false);
        this.visitExpression(statement.condition, repeatScope);
        break;
      }
      case "ForStatement": {
        this.visitExpression(statement.start, scope);
        this.visitExpression(statement.end, scope);
        if (statement.step) this.visitExpression(statement.step, scope);
        const loopScope = childScope(scope);
        this.declare(statement.variable, loopScope);
        this.visitBlock(statement.body, loopScope, false);
        break;
      }
      case "ForInStatement": {
        for (const iterator of statement.iterator || []) this.visitExpression(iterator, scope);
        const loopScope = childScope(scope);
        for (const variable of statement.variables || []) this.declare(variable, loopScope);
        this.visitBlock(statement.body, loopScope, false);
        break;
      }
      case "DoStatement":
        this.visitBlock(statement.body, scope, true);
        break;
      case "Block":
        this.visitBlock(statement, scope, true);
        break;
      case "BreakStatement":
      case "ContinueStatement":
        break;
      default:
        throw new Error('IronVeil scope analyzer does not support statement type "' + String(statement.type) + '".');
    }
  }

  private visitLValue(target: any, scope: Scope): void {
    if (!target) return;
    if (target.type === "Identifier") {
      this.reference(target, scope);
      return;
    }
    if (target.type === "MemberExpression") {
      this.visitExpression(target.base, scope);
      if (target.computed && typeof target.indexer !== "string") this.visitExpression(target.indexer, scope);
    }
  }

  private visitExpression(expression: any, scope: Scope): void {
    if (!expression) return;
    switch (expression.type) {
      case "Identifier":
        this.reference(expression, scope);
        break;
      case "BinaryExpression":
        this.visitExpression(expression.left, scope);
        this.visitExpression(expression.right, scope);
        break;
      case "UnaryExpression":
        this.visitExpression(expression.argument, scope);
        break;
      case "MemberExpression":
        this.visitExpression(expression.base, scope);
        if (expression.computed && typeof expression.indexer !== "string") this.visitExpression(expression.indexer, scope);
        break;
      case "CallExpression":
        this.visitExpression(expression.base, scope);
        for (const argument of expression.arguments || []) this.visitExpression(argument, scope);
        break;
      case "TableConstructor":
        for (const field of expression.fields || []) {
          if (field.type === "General" && field.key) this.visitExpression(field.key, scope);
          this.visitExpression(field.value, scope);
        }
        break;
      case "FunctionExpression":
        this.visitFunction(expression.parameters || [], expression.body, scope);
        break;
      case "StringLiteral":
      case "NumberLiteral":
      case "BooleanLiteral":
      case "NilLiteral":
      case "VarargLiteral":
        break;
      default:
        throw new Error('IronVeil scope analyzer does not support expression type "' + String(expression.type) + '".');
    }
  }
}
