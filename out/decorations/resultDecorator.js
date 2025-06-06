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
        // Define the style for our inline result display
        // Blue color similar to Quokka's evaluation results
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#4A90E2',
                fontStyle: 'italic',
                margin: '0 0 0 1em', // Add some space before the decoration
            },
            // We can add more styles for errors, logs, etc. later by creating more decoration types
        });
        // Define a more prominent style for syntax errors
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
    displayResults(editor, results) {
        console.log('[ResultDecorator] displayResults called. Number of results:', results.length);
        console.log('[ResultDecorator] Results data:', JSON.stringify(results, null, 2)); // Log the actual data
        const regularDecorations = [];
        const errorDecorations = [];
        results.forEach(result => {
            const decorationRange = result.originalRange; // Anchor to the expression itself
            const prefix = result.isError ? 'Error: ' : result.isLog ? 'log: ' : '=> ';
            // Ensure textContent is a string and handle undefined results
            const textValue = result.text === undefined ? 'undefined' : result.text;
            const textContentString = String(textValue).replace(/\n/g, '\\n'); // Escape newlines
            const decorationOption = {
                range: decorationRange,
                renderOptions: {
                    after: {
                        contentText: ` // ${prefix}${textContentString}`,
                    },
                },
            };
            if (result.isError) {
                errorDecorations.push(decorationOption);
            }
            else {
                regularDecorations.push(decorationOption);
            }
        });
        console.log('[ResultDecorator] Applying regular decorations:', regularDecorations.length);
        console.log('[ResultDecorator] Applying error decorations:', errorDecorations.length);
        editor.setDecorations(this.decorationType, regularDecorations);
        editor.setDecorations(this.errorDecorationType, errorDecorations);
    }
    displaySyntaxErrors(editor, diagnostics) {
        console.log(`[ResultDecorator] displaySyntaxErrors called with ${diagnostics.length} diagnostics`);
        const syntaxErrorDecorations = diagnostics.map((diagnostic, index) => {
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
    clearDecorations(editor) {
        editor.setDecorations(this.decorationType, []);
        editor.setDecorations(this.errorDecorationType, []);
    }
    dispose() {
        this.decorationType.dispose();
        this.errorDecorationType.dispose();
    }
}
exports.ResultDecorator = ResultDecorator;
//# sourceMappingURL=resultDecorator.js.map