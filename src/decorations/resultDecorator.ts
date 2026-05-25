import * as vscode from 'vscode';
import * as util from 'util';

export interface EvaluationResultDisplay {
  text: string;       // The result string to display (truncated)
  fullText: string;   // The full result string for hover
  originalRange: vscode.Range; // The range of the original expression
  isError?: boolean;   // If the result is an error message
  isLog?: boolean;     // If the result is from console.log
  valueType?: string;  // Type of the value for color coding
}

export class ResultDecorator {
  // Color-coded decoration types for different value types
  private stringDecorationType: vscode.TextEditorDecorationType;
  private numberDecorationType: vscode.TextEditorDecorationType;
  private booleanDecorationType: vscode.TextEditorDecorationType;
  private objectDecorationType: vscode.TextEditorDecorationType;
  private undefinedDecorationType: vscode.TextEditorDecorationType;
  private defaultDecorationType: vscode.TextEditorDecorationType;
  private errorDecorationType: vscode.TextEditorDecorationType;
  private logDecorationType: vscode.TextEditorDecorationType;

  // Store full results for hover provider
  private resultCache: Map<string, EvaluationResultDisplay> = new Map();

  constructor() {
    // String values - Green
    this.stringDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#98C379', // Green (similar to Quokka)
        fontStyle: 'italic',
        margin: '0 0 0 1em',
      },
    });

    // Number values - Blue
    this.numberDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#61AFEF', // Blue
        fontStyle: 'italic',
        margin: '0 0 0 1em',
      },
    });

    // Boolean values - Purple
    this.booleanDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#C678DD', // Purple
        fontStyle: 'italic',
        margin: '0 0 0 1em',
      },
    });

    // Object/Array values - Gray
    this.objectDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#ABB2BF', // Gray
        fontStyle: 'italic',
        margin: '0 0 0 1em',
      },
    });

    // undefined/null values - Gray italic (more subtle)
    this.undefinedDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#5C6370', // Darker gray
        fontStyle: 'italic',
        margin: '0 0 0 1em',
      },
    });

    // Default/Function/Symbol - Yellow/Orange
    this.defaultDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#E5C07B', // Yellow/Orange
        fontStyle: 'italic',
        margin: '0 0 0 1em',
      },
    });

    // Log messages - Cyan
    this.logDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#56B6C2', // Cyan
        fontStyle: 'italic',
        margin: '0 0 0 1em',
      },
    });

    // Error messages - Red with background
    this.errorDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('errorForeground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em',
        fontWeight: 'bold',
      },
      backgroundColor: new vscode.ThemeColor('errorBackground'),
      border: '1px solid',
      borderColor: new vscode.ThemeColor('errorBorder'),
    });
  }

  /**
   * Truncate a value string for inline display
   */
  private truncateValue(value: string, maxLength: number = 50): string {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  }

  /**
   * Get the appropriate decoration type based on value type
   */
  private getDecorationTypeForValueType(valueType: string | undefined): vscode.TextEditorDecorationType {
    switch (valueType) {
      case 'string':
        return this.stringDecorationType;
      case 'number':
        return this.numberDecorationType;
      case 'boolean':
        return this.booleanDecorationType;
      case 'object':
        return this.objectDecorationType;
      case 'undefined':
      case 'null':
        return this.undefinedDecorationType;
      default:
        return this.defaultDecorationType;
    }
  }

  public displayResults(editor: vscode.TextEditor, results: EvaluationResultDisplay[]) {
    console.log('[ResultDecorator] displayResults called. Number of results:', results.length);

    // Clear cache and rebuild
    this.resultCache.clear();

    // Group decorations by type
    const decorationsByType: Map<vscode.TextEditorDecorationType, vscode.DecorationOptions[]> = new Map();

    results.forEach(result => {
      const decorationRange = result.originalRange;
      const cacheKey = `${editor.document.uri.toString()}_${decorationRange.start.line}_${decorationRange.start.character}`;
      
      // Cache the full result for hover
      this.resultCache.set(cacheKey, result);

      const prefix = result.isError ? 'Error: ' : result.isLog ? 'log: ' : '=> ';
      
      // Truncate the display text
      const truncatedText = this.truncateValue(result.text);
      const textContentString = truncatedText.replace(/\n/g, '\\n'); // Escape newlines

      const decorationOption: vscode.DecorationOptions = {
        range: decorationRange,
        renderOptions: {
          after: {
            contentText: ` // ${prefix}${textContentString}`,
          },
        },
        // Store the cache key in the decoration for hover lookup
        hoverMessage: this.createHoverMessage(result)
      };

      // Determine which decoration type to use
      let decorationType: vscode.TextEditorDecorationType;
      if (result.isError) {
        decorationType = this.errorDecorationType;
      } else if (result.isLog) {
        decorationType = this.logDecorationType;
      } else {
        decorationType = this.getDecorationTypeForValueType(result.valueType);
      }

      // Add to appropriate group
      if (!decorationsByType.has(decorationType)) {
        decorationsByType.set(decorationType, []);
      }
      decorationsByType.get(decorationType)!.push(decorationOption);
    });

    // Apply all decorations
    this.clearDecorations(editor);
    decorationsByType.forEach((decorations, decorationType) => {
      editor.setDecorations(decorationType, decorations);
    });

    console.log('[ResultDecorator] Applied decorations for', decorationsByType.size, 'types');
  }

  /**
   * Create a hover message for a result
   */
  private createHoverMessage(result: EvaluationResultDisplay): vscode.MarkdownString {
    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.isTrusted = true;
    
    if (result.isError) {
      hoverMessage.appendCodeblock(result.fullText, 'javascript');
    } else {
      hoverMessage.appendMarkdown(`**Type:** \`${result.valueType || 'unknown'}\`\n\n`);
      hoverMessage.appendCodeblock(result.fullText, 'javascript');
      
      if (result.text !== result.fullText) {
        hoverMessage.appendMarkdown('\n*Value truncated for inline display*');
      }
    }
    
    return hoverMessage;
  }

  public displaySyntaxErrors(editor: vscode.TextEditor, diagnostics: vscode.Diagnostic[]) {
    console.log(`[ResultDecorator] displaySyntaxErrors called with ${diagnostics.length} diagnostics`);
    
    const syntaxErrorDecorations: vscode.DecorationOptions[] = diagnostics.map((diagnostic, index) => {
      const errorText = diagnostic.message.length > 50 
        ? diagnostic.message.substring(0, 50) + '...' 
        : diagnostic.message;

      const lineInfo = `Line ${diagnostic.range.start.line + 1}: `;
      const fullErrorText = lineInfo + errorText;

      return {
        range: diagnostic.range,
        renderOptions: {
          after: {
            contentText: ` // Syntax Error: ${fullErrorText}`,
          },
        },
        hoverMessage: new vscode.MarkdownString().appendCodeblock(diagnostic.message, 'javascript')
      };
    });

    editor.setDecorations(this.errorDecorationType, syntaxErrorDecorations);
  }

  public clearDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(this.stringDecorationType, []);
    editor.setDecorations(this.numberDecorationType, []);
    editor.setDecorations(this.booleanDecorationType, []);
    editor.setDecorations(this.objectDecorationType, []);
    editor.setDecorations(this.undefinedDecorationType, []);
    editor.setDecorations(this.defaultDecorationType, []);
    editor.setDecorations(this.logDecorationType, []);
    editor.setDecorations(this.errorDecorationType, []);
    
    this.resultCache.clear();
  }

  /**
   * Get cached result for hover provider
   */
  public getCachedResult(documentUri: string, line: number, character: number): EvaluationResultDisplay | undefined {
    const cacheKey = `${documentUri}_${line}_${character}`;
    return this.resultCache.get(cacheKey);
  }

  public dispose() {
    this.stringDecorationType.dispose();
    this.numberDecorationType.dispose();
    this.booleanDecorationType.dispose();
    this.objectDecorationType.dispose();
    this.undefinedDecorationType.dispose();
    this.defaultDecorationType.dispose();
    this.logDecorationType.dispose();
    this.errorDecorationType.dispose();
  }
}
