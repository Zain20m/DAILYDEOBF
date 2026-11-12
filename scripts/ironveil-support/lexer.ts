// Compatibility adapter: the parser accepts source text rather than a token array.
export class Lexer {
  constructor(private readonly source: string) {}
  tokenize(): string {
    return this.source;
  }
}
