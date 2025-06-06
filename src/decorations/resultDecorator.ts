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
    // We'll make it look like a comment, and style it further later
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('editorCodeLens.foreground'), // A subdued color, like comments or CodeLens
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
    const syntaxErrorDecorations: vscode.DecorationOptions[] = diagnostics.map(diagnostic => {
      const errorText = diagnostic.message.length > 50 
        ? diagnostic.message.substring(0, 50) + '...' 
        : diagnostic.message;

      return {
        range: diagnostic.range,
        renderOptions: {
          after: {
            contentText: ` // Syntax Error: ${errorText}`,
          },
        },
      };
    });

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
