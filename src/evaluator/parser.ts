import * as vscode from 'vscode';
import * as acorn from 'acorn';

/**
 * Represents information about a parsed JavaScript expression or statement.
 */
export interface ExpressionInfo {
  text: string; // The raw text of the expression/statement
  range: vscode.Range; // The range in the document where this expression is located
  node: acorn.Node; // The AST node from Acorn
  type: 'statement' | 'identifier' | 'expression' | 'liveComment'; // Type of the expression
}

/**
 * Represents a live comment
 */
export interface LiveCommentInfo {
  expressionRange: vscode.Range; // Range of the expression to evaluate
  expressionText: string; // Text of the expression
  commentRange: vscode.Range; // Range of the comment itself
  commentType: 'block' | 'line';
  timing?: boolean;
}

/**
 * Represents the result of parsing a document.
 */
export interface ParseResult {
  expressions: ExpressionInfo[];
  liveComments: LiveCommentInfo[];
  diagnostics: vscode.Diagnostic[];
}

/**
 * Parses JavaScript code from a TextDocument to identify evaluable expressions.
 */
export class ExpressionParser {
  /**
   * Parses the given JavaScript code string and extracts evaluable expressions.
   * For now, this is a basic implementation that parses the whole document.
   *
   * @param document The VS Code TextDocument to parse.
   * @returns An array of ExpressionInfo objects representing evaluable parts of the code.
   */
  public parseDocument(document: vscode.TextDocument): ParseResult {
    const code = document.getText();
    const expressions: ExpressionInfo[] = [];
    const diagnostics: vscode.Diagnostic[] = [];

    try {
      // Parse the entire document content into an AST
      // Options: ecmaVersion, locations, ranges are important
      const ast = acorn.parse(code, {
        ecmaVersion: 'latest', // Use the latest ECMAScript version
        locations: true,       // Include line/column location info for nodes
        ranges: true,          // Include character index ranges for nodes
        sourceType: 'module',  // Assume module context, can be 'script' too
        allowReserved: true    // Allow reserved words in non-strict mode contexts
      }) as acorn.Node & { body?: acorn.Node[] }; // Type assertion for top-level body

      console.log('AST generated:', ast);

      // Iterate through top-level statements in the AST body
      if (ast.body && Array.isArray(ast.body)) {
        ast.body.forEach(node => {
          if (node.range && node.loc) {
            const startPos = document.positionAt(node.range[0]);
            const endPos = document.positionAt(node.range[1]);
            const range = new vscode.Range(startPos, endPos);
            const text = document.getText(range);

            // Determine the type of expression
            let type: ExpressionInfo['type'] = 'statement';
            
            if (node.type === 'ExpressionStatement') {
              const exprStatement = node as acorn.ExpressionStatement;
              if (exprStatement.expression.type === 'Identifier') {
                type = 'identifier';
              } else {
                type = 'expression';
              }
            }

            expressions.push({
              text: text,
              range: range,
              node: node,
              type: type
            });

            // If this is a statement with nested expressions, extract them too
            if (type === 'statement' || type === 'expression') {
              this.extractNestedExpressions(node, document, expressions);
            }
          }
        });
      }

    } catch (error) {
      console.error('Error parsing JavaScript:', error);
      // Check if the error object has Acorn's location properties
      if (error instanceof Error && 
          typeof (error as any).loc === 'object' && 
          (error as any).loc !== null &&
          typeof (error as any).loc.line === 'number' && 
          typeof (error as any).loc.column === 'number') {
        
        const errorWithLocation = error as Error & { loc: { line: number, column: number }, pos?: number, raisedAt?: number };
        const line = errorWithLocation.loc.line - 1; // VS Code lines are 0-indexed
        const column = errorWithLocation.loc.column;
        
        console.log(`[Parser] Error at line ${line + 1}, column ${column}:`, errorWithLocation.message);
        console.log(`[Parser] Document has ${document.lineCount} lines`);
        
        let errorRange: vscode.Range;
        
        // Bounds checking for line number
        if (line < 0 || line >= document.lineCount) {
          console.warn(`[Parser] Error line ${line + 1} is out of bounds, using line 0`);
          errorRange = new vscode.Range(0, 0, 0, Math.min(10, document.lineAt(0).text.length));
        } else {
          try {
            // Use pos and raisedAt for a more precise error range if available
            if (typeof errorWithLocation.pos === 'number' && typeof errorWithLocation.raisedAt === 'number' && errorWithLocation.raisedAt > errorWithLocation.pos) {
              const startPos = document.positionAt(errorWithLocation.pos);
              const endPos = document.positionAt(errorWithLocation.raisedAt);
              errorRange = new vscode.Range(startPos, endPos);
              console.log(`[Parser] Using pos-based range: ${startPos.line}:${startPos.character} to ${endPos.line}:${endPos.character}`);
            } else {
              // Fallback: highlight the character at the reported column, or a small part of the line
              const lineText = document.lineAt(line).text;
              console.log(`[Parser] Line ${line + 1} text length: ${lineText.length}, error column: ${column}`);
              
              // Ensure column is within the line bounds for highlighting
              const safeColumnStart = Math.max(0, Math.min(column, lineText.length > 0 ? lineText.length - 1 : 0));
              const safeColumnEnd = Math.min(column + 5, lineText.length); // Highlight a few more characters for visibility
              errorRange = new vscode.Range(line, safeColumnStart, line, Math.max(safeColumnEnd, safeColumnStart + 1));
              console.log(`[Parser] Using column-based range: ${line}:${safeColumnStart} to ${line}:${safeColumnEnd}`);
            }
          } catch (rangeError) {
            console.error('[Parser] Error creating range:', rangeError);
            // Last resort: highlight beginning of the problematic line
            errorRange = new vscode.Range(line, 0, line, Math.min(10, document.lineAt(line).text.length));
          }
        }

        const diagnostic = new vscode.Diagnostic(
          errorRange,
          errorWithLocation.message.replace(/ \(\d+:\d+\)$/, ''), // Clean up Acorn's message a bit
          vscode.DiagnosticSeverity.Error
        );
        diagnostics.push(diagnostic);
        console.log(`[Parser] Created diagnostic:`, diagnostic);
      } else if (error instanceof Error) {
        // Generic error without specific location info, create a diagnostic for the whole document or line 0
        const range = new vscode.Range(0, 0, 0, Math.min(10, document.lineCount > 0 ? document.lineAt(0).text.length : 0));
        const diagnostic = new vscode.Diagnostic(range, 'Parsing error: ' + error.message, vscode.DiagnosticSeverity.Error);
        diagnostics.push(diagnostic);
        console.log(`[Parser] Created generic diagnostic:`, diagnostic);
      } else {
        // Unknown error type
        const range = new vscode.Range(0, 0, 0, Math.min(10, document.lineCount > 0 ? document.lineAt(0).text.length : 0));
        const diagnostic = new vscode.Diagnostic(range, 'An unknown parsing error occurred.', vscode.DiagnosticSeverity.Error);
        diagnostics.push(diagnostic);
        console.log(`[Parser] Created unknown error diagnostic:`, diagnostic);
      }
    } // End of try-catch block

    // Parse live comments
    const liveComments = this.parseLiveComments(document, code);

    return { expressions, liveComments, diagnostics };
  }

  /**
   * Parse live comments from the document
   */
  private parseLiveComments(document: vscode.TextDocument, code: string): LiveCommentInfo[] {
    const liveComments: LiveCommentInfo[] = [];
    const lines = code.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Check for block comment
      const blockCommentRegex = new RegExp('\\/\\*\\?(\\.)?\\*\\/', 'g');
      let match;
      while ((match = blockCommentRegex.exec(line)) !== null) {
        const commentStart = match.index;
        
        // Find the expression before the comment
        const textBeforeComment = line.substring(0, commentStart).trim();
        
        // Try to find a complete expression before the comment
        let expressionText = '';
        let expressionStart = 0;
        
        // Look backwards for the start of an expression
        const terminators = [';', '{', '}', '(', ')', ',', '='];
        for (let i = textBeforeComment.length - 1; i >= 0; i--) {
          if (terminators.includes(textBeforeComment[i])) {
            expressionStart = i + 1;
            break;
          }
        }
        
        expressionText = textBeforeComment.substring(expressionStart).trim();
        
        if (expressionText) {
          const expressionStartPos = new vscode.Position(lineIndex, expressionStart);
          const expressionEndPos = new vscode.Position(lineIndex, expressionStart + expressionText.length);
          const commentStartPos = new vscode.Position(lineIndex, commentStart);
          const commentEndPos = new vscode.Position(lineIndex, commentStart + match[0].length);
          
          liveComments.push({
            expressionRange: new vscode.Range(expressionStartPos, expressionEndPos),
            expressionText: expressionText,
            commentRange: new vscode.Range(commentStartPos, commentEndPos),
            commentType: 'block',
            timing: match[1] === '.'
          });
        }
      }

      // Check for line comment
      const lineCommentRegex = new RegExp('\\/\\/\\?(\\.)?(.*)$');
      const lineMatch = line.match(lineCommentRegex);
      if (lineMatch && lineMatch.index !== undefined) {
        const commentStart = lineMatch.index;
        const textBeforeComment = line.substring(0, commentStart).trim();
        
        // Remove trailing semicolon if present
        const expressionText = textBeforeComment.replace(/;$/, '');
        
        if (expressionText) {
          const expressionStartPos = new vscode.Position(lineIndex, 0);
          const expressionEndPos = new vscode.Position(lineIndex, textBeforeComment.length);
          const commentStartPos = new vscode.Position(lineIndex, commentStart);
          const commentEndPos = new vscode.Position(lineIndex, line.length);
          
          liveComments.push({
            expressionRange: new vscode.Range(expressionStartPos, expressionEndPos),
            expressionText: expressionText,
            commentRange: new vscode.Range(commentStartPos, commentEndPos),
            commentType: 'line',
            timing: lineMatch[1] === '.'
          });
        }
      }
    }

    return liveComments;
  }

  /**
   * Recursively extract identifier expressions from AST nodes
   * This allows showing values when users just type a variable name
   */
  private extractNestedExpressions(
    node: acorn.Node, 
    document: vscode.TextDocument, 
    expressions: ExpressionInfo[]
  ): void {
    // Track parent nodes to avoid extracting identifiers that are part of member expressions
    const walk = (n: acorn.Node, parent?: acorn.Node) => {
      // If this is an identifier, check if it should be added
      if (n.type === 'Identifier' && n.range) {
        // Skip identifiers that are:
        // 1. Part of a MemberExpression (e.g., 'console' in console.log)
        // 2. Part of a CallExpression callee (e.g., function name in fn())
        // 3. Property names in objects
        if (parent) {
          if (parent.type === 'MemberExpression') {
            const memberExpr = parent as acorn.MemberExpression;
            // Skip if this identifier is the object or property of a member expression
            if ((memberExpr as any).object === n || (memberExpr as any).property === n) {
              // Still walk children but don't add this identifier
              return;
            }
          }
          if (parent.type === 'CallExpression') {
            const callExpr = parent as acorn.CallExpression;
            // Skip if this identifier is the callee
            if ((callExpr as any).callee === n) {
              return;
            }
          }
        }

        const startPos = document.positionAt(n.range[0]);
        const endPos = document.positionAt(n.range[1]);
        const range = new vscode.Range(startPos, endPos);
        
        // Only add if it's not already in the list
        const text = document.getText(range);
        const alreadyExists = expressions.some(e => 
          e.range.start.line === range.start.line && 
          e.range.start.character === range.start.character
        );
        
        if (!alreadyExists) {
          expressions.push({
            text: text,
            range: range,
            node: n,
            type: 'identifier'
          });
        }
      }

      // Recursively walk child nodes
      for (const key of Object.keys(n)) {
        const value = (n as any)[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(child => {
              if (child && typeof child === 'object' && 'type' in child) {
                walk(child as acorn.Node, n);
              }
            });
          } else if ('type' in value) {
            walk(value as acorn.Node, n);
          }
        }
      }
    };

    walk(node);
  }
}
