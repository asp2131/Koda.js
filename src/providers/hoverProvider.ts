import * as vscode from 'vscode';
import { ResultDecorator } from '../decorations/resultDecorator';

/**
 * Provides hover information for evaluated expressions
 */
export class EvaluationHoverProvider implements vscode.HoverProvider {
  constructor(private resultDecorator: ResultDecorator) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    // Try to get cached result from the decorator
    const result = this.resultDecorator.getCachedResult(
      document.uri.toString(),
      position.line,
      position.character
    );

    if (result) {
      const hoverContent = new vscode.MarkdownString();
      
      if (result.isError) {
        hoverContent.appendMarkdown(`### Error\n\n`);
        hoverContent.appendCodeblock(result.fullText, 'javascript');
      } else {
        hoverContent.appendMarkdown(`### Value\n\n`);
        hoverContent.appendMarkdown(`**Type:** \`${result.valueType || 'unknown'}\`\n\n`);
        hoverContent.appendCodeblock(result.fullText, 'javascript');
        
        if (result.text !== result.fullText) {
          hoverContent.appendMarkdown(`\n---\n*Truncated for inline display. Showing full value above.*`);
        }
      }
      
      return new vscode.Hover(hoverContent);
    }

    return undefined;
  }
}
