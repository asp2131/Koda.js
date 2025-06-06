import * as vscode from 'vscode';
import * as acorn from 'acorn';

/**
 * Represents information about a parsed JavaScript expression or statement.
 */
export interface ExpressionInfo {
  text: string; // The raw text of the expression/statement
  range: vscode.Range; // The range in the document where this expression is located
  node: acorn.Node; // The AST node from Acorn
  // Potentially add type: 'expression' | 'statement' | 'declaration' later if needed
}

/**
 * Represents the result of parsing a document.
 */
export interface ParseResult {
  expressions: ExpressionInfo[];
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

      // Placeholder: Iterate through top-level statements in the AST body
      // More sophisticated logic will be needed to extract meaningful expressions.
      if (ast.body && Array.isArray(ast.body)) {
        ast.body.forEach(node => {
          if (node.range && node.loc) {
            const startPos = document.positionAt(node.range[0]);
            const endPos = document.positionAt(node.range[1]);
            const range = new vscode.Range(startPos, endPos);
            const text = document.getText(range);

            expressions.push({
              text: text,
              range: range,
              node: node
            });
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

    return { expressions, diagnostics };
  }

  // Future methods might include:
  // - extractExpressionsFromNode(node: acorn.Node): ExpressionInfo[]
  // - isEvaluableNode(node: acorn.Node): boolean
}
