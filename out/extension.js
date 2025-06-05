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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const parser_1 = require("./evaluator/parser");
const engine_1 = require("./evaluator/engine");
const resultDecorator_1 = require("./decorations/resultDecorator");
// Global state for live evaluation
let isLiveEvaluationActive = false;
let textDocumentChangeDisposable;
let liveEvaluationStatusBarItem;
let debounceTimer;
// Global diagnostics collection, initialized in activate
let diagnostics;
async function evaluateEditor(editor, parser, evaluator, resultDecorator, currentDiagnostics) {
    if (!editor) {
        return;
    }
    if (editor.document.languageId !== 'javascript' && editor.document.languageId !== 'typescript') {
        if (!isLiveEvaluationActive) {
            vscode.window.showInformationMessage('Please use this extension with a JavaScript or TypeScript file.');
        }
        return;
    }
    resultDecorator.clearDecorations(editor);
    currentDiagnostics.clear();
    const document = editor.document;
    const parseOutput = parser.parseDocument(document); // Corrected: pass only document
    const expressions = parseOutput.expressions;
    const syntaxDiagnosticsFromParser = parseOutput.diagnostics;
    if (syntaxDiagnosticsFromParser.length > 0) {
        currentDiagnostics.set(document.uri, syntaxDiagnosticsFromParser);
        if (!isLiveEvaluationActive) {
            vscode.window.showErrorMessage('Syntax errors found. See Problems panel.');
        }
    }
    if (expressions.length === 0) {
        if (!isLiveEvaluationActive && syntaxDiagnosticsFromParser.length === 0) {
            vscode.window.showInformationMessage('No JavaScript expressions found to evaluate.');
        }
        return;
    }
    const displayableResults = [];
    const evaluationContext = evaluator.createContext((logMessage, expressionRange) => {
        if (expressionRange) {
            displayableResults.push({
                text: logMessage,
                originalRange: expressionRange,
                isLog: true,
            });
        }
        else {
            console.log(`[Sandbox Log - Unassociated in evaluateEditor]: ${logMessage}`);
        }
    });
    for (const expr of expressions) { // Using for...of for cleaner iteration
        try {
            evaluationContext.__currentExpressionRange = expr.range;
            // Corrected argument order and variable name for evaluation output
            const evaluationOutput = evaluator.evaluate(expr.text, expr.range, evaluationContext);
            delete evaluationContext.__currentExpressionRange;
            if (evaluationOutput.error) {
                displayableResults.push({ text: evaluationOutput.error, originalRange: expr.range, isError: true });
            }
            else {
                let isConsoleLogCall = false;
                const node = expr.node; // node is acorn.Node
                if (node.type === 'ExpressionStatement') {
                    // Type assertion for ExpressionStatement
                    const expressionStatement = node;
                    if (expressionStatement.expression.type === 'CallExpression') {
                        // Type assertion for CallExpression
                        const callExpression = expressionStatement.expression;
                        if (callExpression.callee.type === 'MemberExpression') {
                            // Type assertion for MemberExpression
                            const memberExpression = callExpression.callee;
                            if (memberExpression.object.type === 'Identifier') {
                                // Type assertion for Identifier
                                const identifier = memberExpression.object;
                                if (identifier.name === 'console') {
                                    isConsoleLogCall = true;
                                }
                            }
                        }
                    }
                }
                if (evaluationOutput.result !== undefined && !isConsoleLogCall) {
                    displayableResults.push({ text: String(evaluationOutput.result), originalRange: expr.range });
                }
            }
        }
        catch (e) {
            console.error(`[evaluateEditor] Error evaluating expression '${expr.text}':`, e);
            delete evaluationContext.__currentExpressionRange; // Ensure cleanup on error too
            displayableResults.push({ text: e.message || 'Unknown evaluation error', originalRange: expr.range, isError: true });
        }
    }
    if (displayableResults.length > 0) {
        displayableResults.sort((a, b) => a.originalRange.start.line - b.originalRange.start.line);
        resultDecorator.displayResults(editor, displayableResults);
    }
}
function activate(context) {
    console.log('Congratulations, your extension "vscode-js-evaluator" is now active!');
    diagnostics = vscode.languages.createDiagnosticCollection("javascriptEvaluator");
    context.subscriptions.push(diagnostics);
    const parser = new parser_1.ExpressionParser();
    const evaluator = new engine_1.SafeEvaluator();
    const resultDecorator = new resultDecorator_1.ResultDecorator();
    liveEvaluationStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(liveEvaluationStatusBarItem);
    const evaluateSelectionCommand = vscode.commands.registerCommand('jsEvaluator.evaluateSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            await evaluateEditor(editor, parser, evaluator, resultDecorator, diagnostics);
        }
    });
    const startLiveEvaluationCommand = vscode.commands.registerCommand('jsEvaluator.startLiveEvaluation', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Open a JavaScript/TypeScript file to start live evaluation.');
            return;
        }
        if (editor.document.languageId !== 'javascript' && editor.document.languageId !== 'typescript') {
            vscode.window.showInformationMessage('Live evaluation only works for JavaScript/TypeScript files.');
            return;
        }
        isLiveEvaluationActive = true;
        liveEvaluationStatusBarItem.text = "$(zap) JS Live";
        liveEvaluationStatusBarItem.tooltip = "JavaScript Live Evaluation is Active";
        liveEvaluationStatusBarItem.show();
        console.log('Starting live evaluation...');
        await evaluateEditor(editor, parser, evaluator, resultDecorator, diagnostics);
        if (textDocumentChangeDisposable) {
            textDocumentChangeDisposable.dispose();
        }
        textDocumentChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
            if (isLiveEvaluationActive && event.document === vscode.window.activeTextEditor?.document) {
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                debounceTimer = setTimeout(async () => {
                    const currentEditor = vscode.window.activeTextEditor;
                    if (currentEditor) {
                        await evaluateEditor(currentEditor, parser, evaluator, resultDecorator, diagnostics);
                    }
                }, 500);
            }
        });
        context.subscriptions.push(textDocumentChangeDisposable);
        vscode.window.showInformationMessage('JavaScript Live Evaluation Started.');
    });
    const stopLiveEvaluationCommand = vscode.commands.registerCommand('jsEvaluator.stopLiveEvaluation', () => {
        console.log('Stopping live evaluation...');
        isLiveEvaluationActive = false;
        liveEvaluationStatusBarItem.hide();
        if (textDocumentChangeDisposable) {
            textDocumentChangeDisposable.dispose();
            textDocumentChangeDisposable = undefined;
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = undefined;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            resultDecorator.clearDecorations(editor);
            diagnostics.clear();
        }
        vscode.window.showInformationMessage('JavaScript Live Evaluation Stopped.');
    });
    const clearAllResultsCommand = vscode.commands.registerCommand('jsEvaluator.clearAllResults', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            resultDecorator.clearDecorations(editor);
            diagnostics.clear();
            vscode.window.showInformationMessage('All evaluation results and diagnostics cleared.');
        }
        else {
            vscode.window.showInformationMessage('No active editor to clear results from.');
        }
    });
    context.subscriptions.push(evaluateSelectionCommand, startLiveEvaluationCommand, stopLiveEvaluationCommand, clearAllResultsCommand);
}
exports.activate = activate;
function deactivate() {
    console.log('Your extension "vscode-js-evaluator" is now deactivated.');
    if (textDocumentChangeDisposable) {
        textDocumentChangeDisposable.dispose();
    }
    if (liveEvaluationStatusBarItem) {
        liveEvaluationStatusBarItem.dispose();
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map