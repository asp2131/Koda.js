import * as vscode from 'vscode';
import { EvaluationResultDisplay } from '../decorations/resultDecorator';

/**
 * Tree item for the Value Explorer
 */
export class ValueNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly result?: EvaluationResultDisplay,
    public readonly children?: ValueNode[]
  ) {
    super(label, collapsibleState);
    
    if (result) {
      this.tooltip = result.fullText;
      this.description = result.isError ? 'Error' : result.valueType || 'value';
      
      // Set icon based on type
      if (result.isError) {
        this.iconPath = new vscode.ThemeIcon('error');
      } else if (result.isLog) {
        this.iconPath = new vscode.ThemeIcon('output');
      } else if (result.valueType === 'string') {
        this.iconPath = new vscode.ThemeIcon('symbol-string');
      } else if (result.valueType === 'number') {
        this.iconPath = new vscode.ThemeIcon('symbol-numeric');
      } else if (result.valueType === 'boolean') {
        this.iconPath = new vscode.ThemeIcon('symbol-boolean');
      } else if (result.valueType === 'object' || result.valueType === 'array') {
        this.iconPath = new vscode.ThemeIcon('symbol-object');
      } else {
        this.iconPath = new vscode.ThemeIcon('symbol-variable');
      }

      // Add command to copy value on click
      this.command = {
        command: 'jsEvaluator.copyValueFromExplorer',
        title: 'Copy Value',
        arguments: [result.fullText]
      };
    }
  }
}

/**
 * Tree data provider for the Value Explorer panel
 */
export class ValueExplorerProvider implements vscode.TreeDataProvider<ValueNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<ValueNode | undefined | null | void> = new vscode.EventEmitter<ValueNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ValueNode | undefined | null | void> = this._onDidChangeTreeData.event;

  private results: EvaluationResultDisplay[] = [];
  private document: vscode.TextDocument | undefined;

  /**
   * Update the results displayed in the explorer
   */
  public updateResults(results: EvaluationResultDisplay[], document: vscode.TextDocument) {
    this.results = results;
    this.document = document;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Clear all results
   */
  public clear() {
    this.results = [];
    this.document = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ValueNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ValueNode): Thenable<ValueNode[]> {
    if (element) {
      // Return children if this is a parent node
      return Promise.resolve(element.children || []);
    }

    // Return root nodes (grouped by line number)
    if (this.results.length === 0) {
      return Promise.resolve([]);
    }

    // Group results by line
    const groupedByLine = new Map<number, EvaluationResultDisplay[]>();
    
    for (const result of this.results) {
      const line = result.originalRange.start.line;
      if (!groupedByLine.has(line)) {
        groupedByLine.set(line, []);
      }
      groupedByLine.get(line)!.push(result);
    }

    // Create tree nodes
    const nodes: ValueNode[] = [];
    const sortedLines = Array.from(groupedByLine.keys()).sort((a, b) => a - b);

    for (const line of sortedLines) {
      const lineResults = groupedByLine.get(line)!;
      
      if (this.document) {
        const lineText = this.document.lineAt(line).text.trim();
        const shortLineText = lineText.length > 40 ? lineText.substring(0, 40) + '...' : lineText;
        
        if (lineResults.length === 1) {
          // Single result on this line - show it directly
          const result = lineResults[0];
          nodes.push(new ValueNode(
            `${shortLineText}`,
            vscode.TreeItemCollapsibleState.None,
            result
          ));
        } else {
          // Multiple results on this line - create a parent node
          const children = lineResults.map((result, index) => {
            const prefix = result.isError ? 'Error' : result.isLog ? 'Log' : `Result ${index + 1}`;
            return new ValueNode(
              `${prefix}: ${result.text}`,
              vscode.TreeItemCollapsibleState.None,
              result
            );
          });

          nodes.push(new ValueNode(
            `Line ${line + 1}: ${shortLineText}`,
            vscode.TreeItemCollapsibleState.Expanded,
            undefined,
            children
          ));
        }
      }
    }

    return Promise.resolve(nodes);
  }
}
