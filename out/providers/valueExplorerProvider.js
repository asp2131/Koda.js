"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValueExplorerProvider = exports.ValueNode = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tree item for the Value Explorer
 */
class ValueNode extends vscode.TreeItem {
    constructor(label, collapsibleState, result, children) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.result = result;
        this.children = children;
        if (result) {
            this.tooltip = result.fullText;
            this.description = result.isError ? 'Error' : result.valueType || 'value';
            // Set icon based on type
            if (result.isError) {
                this.iconPath = new vscode.ThemeIcon('error');
            }
            else if (result.isLog) {
                this.iconPath = new vscode.ThemeIcon('output');
            }
            else if (result.valueType === 'string') {
                this.iconPath = new vscode.ThemeIcon('symbol-string');
            }
            else if (result.valueType === 'number') {
                this.iconPath = new vscode.ThemeIcon('symbol-numeric');
            }
            else if (result.valueType === 'boolean') {
                this.iconPath = new vscode.ThemeIcon('symbol-boolean');
            }
            else if (result.valueType === 'object' || result.valueType === 'array') {
                this.iconPath = new vscode.ThemeIcon('symbol-object');
            }
            else {
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
exports.ValueNode = ValueNode;
/**
 * Tree data provider for the Value Explorer panel
 */
class ValueExplorerProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.results = [];
    }
    /**
     * Update the results displayed in the explorer
     */
    updateResults(results, document) {
        this.results = results;
        this.document = document;
        this._onDidChangeTreeData.fire();
    }
    /**
     * Clear all results
     */
    clear() {
        this.results = [];
        this.document = undefined;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            // Return children if this is a parent node
            return Promise.resolve(element.children || []);
        }
        // Return root nodes (grouped by line number)
        if (this.results.length === 0) {
            return Promise.resolve([]);
        }
        // Group results by line
        const groupedByLine = new Map();
        for (const result of this.results) {
            const line = result.originalRange.start.line;
            if (!groupedByLine.has(line)) {
                groupedByLine.set(line, []);
            }
            groupedByLine.get(line).push(result);
        }
        // Create tree nodes
        const nodes = [];
        const sortedLines = Array.from(groupedByLine.keys()).sort((a, b) => a - b);
        for (const line of sortedLines) {
            const lineResults = groupedByLine.get(line);
            if (this.document) {
                const lineText = this.document.lineAt(line).text.trim();
                const shortLineText = lineText.length > 40 ? lineText.substring(0, 40) + '...' : lineText;
                if (lineResults.length === 1) {
                    // Single result on this line - show it directly
                    const result = lineResults[0];
                    nodes.push(new ValueNode(`${shortLineText}`, vscode.TreeItemCollapsibleState.None, result));
                }
                else {
                    // Multiple results on this line - create a parent node
                    const children = lineResults.map((result, index) => {
                        const prefix = result.isError ? 'Error' : result.isLog ? 'Log' : `Result ${index + 1}`;
                        return new ValueNode(`${prefix}: ${result.text}`, vscode.TreeItemCollapsibleState.None, result);
                    });
                    nodes.push(new ValueNode(`Line ${line + 1}: ${shortLineText}`, vscode.TreeItemCollapsibleState.Expanded, undefined, children));
                }
            }
        }
        return Promise.resolve(nodes);
    }
}
exports.ValueExplorerProvider = ValueExplorerProvider;
//# sourceMappingURL=valueExplorerProvider.js.map