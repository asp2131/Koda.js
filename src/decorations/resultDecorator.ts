import * as vscode from 'vscode';
import { ExpressionInfo } from '../evaluator/parser'; // Assuming ExpressionInfo has range

export interface EvaluationResultDisplay {
  text: string;       // The result string to display
  originalRange: vscode.Range; // The range of the original expression
  isError?: boolean;   // If the result is an error message
  isLog?: boolean;     // If the result is from console.log
}

export class ResultDecorator {
  private decorationType: vscode.TextEditorDecorationType;
  private errorDecorationType: vscode.TextEditorDecorationType;

  constructor() {
    // Define the style for our inline result display
    // Blue color similar to Quokka's evaluation results
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#4A90E2', // Blue color similar to Quokka
        fontStyle: 'italic',
        margin: '0 0 0 1em', // Add some space before the decoration
      },
      // We can add more styles for errors, logs, etc. later by creating more decoration types
    });

    // Define a more prominent style for syntax errors
    this.errorDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('errorForeground'), // Red error color
        fontStyle: 'italic',
        margin: '0 0 0 1em',
        fontWeight: 'bold',
      },
      backgroundColor: new vscode.ThemeColor('errorBackground'),
      border: '1px solid',
      borderColor: new vscode.ThemeColor('errorBorder'),
    });
  }

  public displayResults(editor: vscode.TextEditor, results: EvaluationResultDisplay[]) {
    console.log('[ResultDecorator] displayResults called. Number of results:', results.length);
    console.log('[ResultDecorator] Results data:', JSON.stringify(results, null, 2)); // Log the actual data

    const regularDecorations: vscode.DecorationOptions[] = [];
    const errorDecorations: vscode.DecorationOptions[] = [];

    results.forEach(result => {
      const decorationRange = result.originalRange; // Anchor to the expression itself

      const prefix = result.isError ? 'Error: ' : result.isLog ? 'log: ' : '=> ';
      // Ensure textContent is a string and handle undefined results
      const textValue = result.text === undefined ? 'undefined' : result.text;
      const textContentString = String(textValue).replace(/\n/g, '\\n'); // Escape newlines

      const decorationOption: vscode.DecorationOptions = {
        range: decorationRange,
        renderOptions: {
          after: {
            contentText: ` // ${prefix}${textContentString}`,
          },
        },
      };

      if (result.isError) {
        errorDecorations.push(decorationOption);
      } else {
        regularDecorations.push(decorationOption);
      }
    });

    console.log('[ResultDecorator] Applying regular decorations:', regularDecorations.length);
    console.log('[ResultDecorator] Applying error decorations:', errorDecorations.length);
    
    editor.setDecorations(this.decorationType, regularDecorations);
    editor.setDecorations(this.errorDecorationType, errorDecorations);
  }

  public displaySyntaxErrors(editor: vscode.TextEditor, diagnostics: vscode.Diagnostic[]) {
    console.log(`[ResultDecorator] displaySyntaxErrors called with ${diagnostics.length} diagnostics`);
    
    const syntaxErrorDecorations: vscode.DecorationOptions[] = diagnostics.map((diagnostic, index) => {
      const errorText = diagnostic.message.length > 50 
        ? diagnostic.message.substring(0, 50) + '...' 
        : diagnostic.message;

      console.log(`[ResultDecorator] Diagnostic ${index}: range=${diagnostic.range.start.line}:${diagnostic.range.start.character}-${diagnostic.range.end.line}:${diagnostic.range.end.character}, message="${errorText}"`);

      // Add line information to the error message for better context
      const lineInfo = `Line ${diagnostic.range.start.line + 1}: `;
      const fullErrorText = lineInfo + errorText;

      return {
        range: diagnostic.range,
        renderOptions: {
          after: {
            contentText: ` // Syntax Error: ${fullErrorText}`,
          },
        },
      };
    });

    console.log(`[ResultDecorator] Applying ${syntaxErrorDecorations.length} syntax error decorations`);
    editor.setDecorations(this.errorDecorationType, syntaxErrorDecorations);
  }

  public clearDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(this.decorationType, []);
    editor.setDecorations(this.errorDecorationType, []);
  }

  public dispose() {
    this.decorationType.dispose();
    this.errorDecorationType.dispose();
  }
}
