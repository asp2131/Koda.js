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
exports.EvaluationHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Provides hover information for evaluated expressions
 */
class EvaluationHoverProvider {
    constructor(resultDecorator) {
        this.resultDecorator = resultDecorator;
    }
    provideHover(document, position, token) {
        // Try to get cached result from the decorator
        const result = this.resultDecorator.getCachedResult(document.uri.toString(), position.line, position.character);
        if (result) {
            const hoverContent = new vscode.MarkdownString();
            if (result.isError) {
                hoverContent.appendMarkdown(`### Error\n\n`);
                hoverContent.appendCodeblock(result.fullText, 'javascript');
            }
            else {
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
exports.EvaluationHoverProvider = EvaluationHoverProvider;
//# sourceMappingURL=hoverProvider.js.map