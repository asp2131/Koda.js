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
        // We'll make it look like a comment, and style it further later
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('editorCodeLens.foreground'),
                fontStyle: 'italic',
                margin: '0 0 0 1em', // Add some space before the decoration
            },
            // We can add more styles for errors, logs, etc. later by creating more decoration types
        });
    }
    displayResults(editor, results) {
        console.log('[ResultDecorator] displayResults called. Number of results:', results.length);
        console.log('[ResultDecorator] Results data:', JSON.stringify(results, null, 2)); // Log the actual data
        const decorations = results.map(result => {
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
                        margin: '0 0 0 1em',
                        color: new vscode.ThemeColor('editorCodeLens.foreground'),
                        fontStyle: 'italic',
                    },
                },
            };
        });
        console.log('[ResultDecorator] Applying decorations:', JSON.stringify(decorations, null, 2));
        editor.setDecorations(this.decorationType, decorations);
    }
    clearDecorations(editor) {
        editor.setDecorations(this.decorationType, []);
    }
    dispose() {
        this.decorationType.dispose();
    }
}
exports.ResultDecorator = ResultDecorator;
//# sourceMappingURL=resultDecorator.js.map