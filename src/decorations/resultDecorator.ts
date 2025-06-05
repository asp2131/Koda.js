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
  }

  public displayResults(editor: vscode.TextEditor, results: EvaluationResultDisplay[]) {
    console.log('[ResultDecorator] displayResults called. Number of results:', results.length);
    console.log('[ResultDecorator] Results data:', JSON.stringify(results, null, 2)); // Log the actual data

    const decorations: vscode.DecorationOptions[] = results.map(result => {
      const decorationRange = result.originalRange; // Anchor to the expression itself

      const prefix = result.isError ? 'Error: ' : result.isLog ? 'log: ' : '=> ';
      // Ensure textContent is a string and handle undefined results
      const textValue = result.text === undefined ? 'undefined' : result.text;
      const textContentString = String(textValue).replace(/\n/g, '\\n'); // Escape newlines

      return {
        range: decorationRange,
        renderOptions: {
          after: {
            contentText: ` // ${prefix}${textContentString}`,
            margin: '0 0 0 1em', // Ensure all styles are present
            color: new vscode.ThemeColor('editorCodeLens.foreground'),
            fontStyle: 'italic',
          },
        },
      };
    });

    console.log('[ResultDecorator] Applying decorations:', JSON.stringify(decorations, null, 2));
    editor.setDecorations(this.decorationType, decorations);
  }

  public clearDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(this.decorationType, []);
  }

  public dispose() {
    this.decorationType.dispose();
  }
}
