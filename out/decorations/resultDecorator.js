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
exports.ResultDecorator = void 0;
const vscode = __importStar(require("vscode"));
class ResultDecorator {
    constructor() {
        // Store full results for hover provider
        this.resultCache = new Map();
        // String values - Green
        this.stringDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#98C379',
                fontStyle: 'italic',
                margin: '0 0 0 1em',
            },
        });
        // Number values - Blue
        this.numberDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#61AFEF',
                fontStyle: 'italic',
                margin: '0 0 0 1em',
            },
        });
        // Boolean values - Purple
        this.booleanDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#C678DD',
                fontStyle: 'italic',
                margin: '0 0 0 1em',
            },
        });
        // Object/Array values - Gray
        this.objectDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#ABB2BF',
                fontStyle: 'italic',
                margin: '0 0 0 1em',
            },
        });
        // undefined/null values - Gray italic (more subtle)
        this.undefinedDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#5C6370',
                fontStyle: 'italic',
                margin: '0 0 0 1em',
            },
        });
        // Default/Function/Symbol - Yellow/Orange
        this.defaultDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#E5C07B',
                fontStyle: 'italic',
                margin: '0 0 0 1em',
            },
        });
        // Log messages - Cyan
        this.logDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#56B6C2',
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
    truncateValue(value, maxLength = 50) {
        if (value.length <= maxLength)
            return value;
        return value.substring(0, maxLength) + '...';
    }
    /**
     * Get the appropriate decoration type based on value type
     */
    getDecorationTypeForValueType(valueType) {
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
    displayResults(editor, results) {
        console.log('[ResultDecorator] displayResults called. Number of results:', results.length);
        // Clear cache and rebuild
        this.resultCache.clear();
        // Group decorations by type
        const decorationsByType = new Map();
        results.forEach(result => {
            const decorationRange = result.originalRange;
            const cacheKey = `${editor.document.uri.toString()}_${decorationRange.start.line}_${decorationRange.start.character}`;
            // Cache the full result for hover
            this.resultCache.set(cacheKey, result);
            const prefix = result.isError ? 'Error: ' : result.isLog ? 'log: ' : '=> ';
            // Truncate the display text
            const truncatedText = this.truncateValue(result.text);
            const textContentString = truncatedText.replace(/\n/g, '\\n'); // Escape newlines
            const decorationOption = {
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
            let decorationType;
            if (result.isError) {
                decorationType = this.errorDecorationType;
            }
            else if (result.isLog) {
                decorationType = this.logDecorationType;
            }
            else {
                decorationType = this.getDecorationTypeForValueType(result.valueType);
            }
            // Add to appropriate group
            if (!decorationsByType.has(decorationType)) {
                decorationsByType.set(decorationType, []);
            }
            decorationsByType.get(decorationType).push(decorationOption);
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
    createHoverMessage(result) {
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.isTrusted = true;
        if (result.isError) {
            hoverMessage.appendCodeblock(result.fullText, 'javascript');
        }
        else {
            hoverMessage.appendMarkdown(`**Type:** \`${result.valueType || 'unknown'}\`\n\n`);
            hoverMessage.appendCodeblock(result.fullText, 'javascript');
            if (result.text !== result.fullText) {
                hoverMessage.appendMarkdown('\n*Value truncated for inline display*');
            }
        }
        return hoverMessage;
    }
    displaySyntaxErrors(editor, diagnostics) {
        console.log(`[ResultDecorator] displaySyntaxErrors called with ${diagnostics.length} diagnostics`);
        const syntaxErrorDecorations = diagnostics.map((diagnostic, index) => {
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
    clearDecorations(editor) {
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
    getCachedResult(documentUri, line, character) {
        const cacheKey = `${documentUri}_${line}_${character}`;
        return this.resultCache.get(cacheKey);
    }
    dispose() {
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
exports.ResultDecorator = ResultDecorator;
//# sourceMappingURL=resultDecorator.js.map