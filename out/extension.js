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
const util = __importStar(require("util"));
const parser_1 = require("./evaluator/parser");
const engine_1 = require("./evaluator/engine");
const resultDecorator_1 = require("./decorations/resultDecorator");
const timeTravelPanel_1 = require("./ui/timeTravelPanel");
const hoverProvider_1 = require("./providers/hoverProvider");
const valueExplorerProvider_1 = require("./providers/valueExplorerProvider");
// Global state for live evaluation
let isLiveEvaluationActive = false;
let textDocumentChangeDisposable;
let liveEvaluationStatusBarItem;
let debounceTimer;
// Global diagnostics collection, initialized in activate
let diagnostics;
// Time travel debugging state
let isTimeTravelEnabled = false;
let timeTravelStatusBarItem;
async function evaluateEditor(editor, parser, evaluator, resultDecorator, currentDiagnostics, valueExplorerProvider) {
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
    const parseOutput = parser.parseDocument(document);
    const expressions = parseOutput.expressions;
    const liveComments = parseOutput.liveComments;
    const syntaxDiagnosticsFromParser = parseOutput.diagnostics;
    if (syntaxDiagnosticsFromParser.length > 0) {
        // Ensure diagnostics are set with the correct source and severity
        const enhancedDiagnostics = syntaxDiagnosticsFromParser.map(diagnostic => ({
            ...diagnostic,
            source: 'JavaScript Evaluator',
            severity: vscode.DiagnosticSeverity.Error
        }));
        currentDiagnostics.set(document.uri, enhancedDiagnostics);
        // Display syntax errors as inline decorations for better visibility
        resultDecorator.displaySyntaxErrors(editor, enhancedDiagnostics);
        if (!isLiveEvaluationActive) {
            vscode.window.showErrorMessage('Syntax errors found. See Problems panel and inline decorations.');
        }
        return;
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
                fullText: logMessage,
                originalRange: expressionRange,
                isLog: true,
                valueType: 'string'
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
                displayableResults.push({
                    text: evaluationOutput.error,
                    fullText: evaluationOutput.error,
                    originalRange: expr.range,
                    isError: true,
                    valueType: 'error'
                });
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
                    const result = evaluationOutput.result;
                    let resultText;
                    let fullResultText;
                    let valueType;
                    if (typeof result === 'object' && result !== null) {
                        // Use util.inspect for proper object formatting
                        fullResultText = util.inspect(result, {
                            depth: null,
                            maxArrayLength: null,
                            breakLength: Infinity,
                            compact: false
                        });
                        resultText = util.inspect(result, {
                            depth: 2,
                            maxArrayLength: 10,
                            maxStringLength: 100,
                            breakLength: Infinity,
                            compact: true
                        });
                        valueType = Array.isArray(result) ? 'array' : 'object';
                    }
                    else {
                        fullResultText = String(result);
                        resultText = String(result);
                        valueType = typeof result;
                    }
                    displayableResults.push({
                        text: resultText,
                        fullText: fullResultText,
                        originalRange: expr.range,
                        valueType: valueType
                    });
                }
            }
        }
        catch (e) {
            console.error(`[evaluateEditor] Error evaluating expression '${expr.text}':`, e);
            delete evaluationContext.__currentExpressionRange; // Ensure cleanup on error too
            const errorMessage = e.message || 'Unknown evaluation error';
            displayableResults.push({
                text: errorMessage,
                fullText: errorMessage,
                originalRange: expr.range,
                isError: true,
                valueType: 'error'
            });
        }
    }
    // Evaluate live comments
    for (const liveComment of liveComments) {
        try {
            const startTime = Date.now();
            const evaluationOutput = evaluator.evaluate(liveComment.expressionText, liveComment.expressionRange, evaluationContext);
            const endTime = Date.now();
            if (evaluationOutput.error) {
                displayableResults.push({
                    text: `Comment Error: ${evaluationOutput.error}`,
                    fullText: evaluationOutput.error,
                    originalRange: liveComment.commentRange,
                    isError: true,
                    valueType: 'error'
                });
            }
            else {
                let resultText;
                let fullResultText;
                let valueType;
                if (typeof evaluationOutput.result === 'object' && evaluationOutput.result !== null) {
                    fullResultText = util.inspect(evaluationOutput.result, {
                        depth: null,
                        maxArrayLength: null,
                        breakLength: Infinity,
                        compact: false
                    });
                    resultText = util.inspect(evaluationOutput.result, {
                        depth: 2,
                        maxArrayLength: 10,
                        maxStringLength: 100,
                        breakLength: Infinity,
                        compact: true
                    });
                    valueType = Array.isArray(evaluationOutput.result) ? 'array' : 'object';
                }
                else {
                    fullResultText = String(evaluationOutput.result);
                    resultText = String(evaluationOutput.result);
                    valueType = typeof evaluationOutput.result;
                }
                // If timing is requested, add it to the display
                if (liveComment.timing) {
                    const executionTime = endTime - startTime;
                    resultText = `${resultText} (${executionTime}ms)`;
                    fullResultText = `${fullResultText}\n\nExecution time: ${executionTime}ms`;
                }
                displayableResults.push({
                    text: resultText,
                    fullText: fullResultText,
                    originalRange: liveComment.commentRange,
                    valueType: valueType
                });
            }
        }
        catch (e) {
            console.error(`[evaluateEditor] Error evaluating live comment '${liveComment.expressionText}':`, e);
            displayableResults.push({
                text: e.message || 'Unknown evaluation error',
                fullText: e.message || 'Unknown evaluation error',
                originalRange: liveComment.commentRange,
                isError: true,
                valueType: 'error'
            });
        }
    }
    if (displayableResults.length > 0) {
        displayableResults.sort((a, b) => a.originalRange.start.line - b.originalRange.start.line);
        resultDecorator.displayResults(editor, displayableResults);
        // Update Value Explorer if available
        if (valueExplorerProvider) {
            valueExplorerProvider.updateResults(displayableResults, document);
        }
    }
}
function activate(context) {
    console.log('Congratulations, your extension "vscode-js-evaluator" is now active!');
    diagnostics = vscode.languages.createDiagnosticCollection("javascriptEvaluator");
    context.subscriptions.push(diagnostics);
    const parser = new parser_1.ExpressionParser();
    const evaluator = new engine_1.SafeEvaluator();
    const resultDecorator = new resultDecorator_1.ResultDecorator();
    // Register hover provider for full value display
    const hoverProvider = new hoverProvider_1.EvaluationHoverProvider(resultDecorator);
    context.subscriptions.push(vscode.languages.registerHoverProvider(['javascript', 'typescript'], hoverProvider));
    // Register Value Explorer
    const valueExplorerProvider = new valueExplorerProvider_1.ValueExplorerProvider();
    vscode.window.registerTreeDataProvider('kodaValueExplorer', valueExplorerProvider);
    liveEvaluationStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(liveEvaluationStatusBarItem);
    // Initialize time travel status bar item
    timeTravelStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    timeTravelStatusBarItem.command = 'jsEvaluator.showTimeTravelPanel';
    context.subscriptions.push(timeTravelStatusBarItem);
    // Enhanced text document change handler with time travel integration
    const enhancedTextDocumentChange = (event) => {
        if (isLiveEvaluationActive && event.document === vscode.window.activeTextEditor?.document) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(async () => {
                const currentEditor = vscode.window.activeTextEditor;
                if (currentEditor) {
                    await evaluateEditor(currentEditor, parser, evaluator, resultDecorator, diagnostics, valueExplorerProvider);
                    // Update time travel panel if open
                    if (timeTravelPanel_1.TimeTravelPanel.currentPanel && isTimeTravelEnabled) {
                        timeTravelPanel_1.TimeTravelPanel.currentPanel.update();
                    }
                }
            }, 500);
        }
    };
    const evaluateSelectionCommand = vscode.commands.registerCommand('jsEvaluator.evaluateSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            await evaluateEditor(editor, parser, evaluator, resultDecorator, diagnostics, valueExplorerProvider);
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
        await evaluateEditor(editor, parser, evaluator, resultDecorator, diagnostics, valueExplorerProvider);
        if (textDocumentChangeDisposable) {
            textDocumentChangeDisposable.dispose();
        }
        textDocumentChangeDisposable = vscode.workspace.onDidChangeTextDocument(enhancedTextDocumentChange);
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
    // Time Travel Debugging Commands
    const toggleTimeTravelCommand = vscode.commands.registerCommand('jsEvaluator.toggleTimeTravel', () => {
        isTimeTravelEnabled = !isTimeTravelEnabled;
        if (isTimeTravelEnabled) {
            evaluator.enableTimeTravel();
            timeTravelStatusBarItem.text = "$(history) Time Travel";
            timeTravelStatusBarItem.tooltip = "Time Travel Debugging is Active - Click to open panel";
            timeTravelStatusBarItem.show();
            vscode.window.showInformationMessage('Time Travel Debugging enabled! Start coding to see execution history.');
            // Auto-open the time travel panel
            timeTravelPanel_1.TimeTravelPanel.createOrShow(context.extensionUri, evaluator.getTimeTravelDebugger());
        }
        else {
            evaluator.disableTimeTravel();
            timeTravelStatusBarItem.hide();
            vscode.window.showInformationMessage('Time Travel Debugging disabled.');
        }
    });
    const showTimeTravelPanelCommand = vscode.commands.registerCommand('jsEvaluator.showTimeTravelPanel', () => {
        if (!isTimeTravelEnabled) {
            vscode.window.showInformationMessage('Enable Time Travel Debugging first.');
            return;
        }
        timeTravelPanel_1.TimeTravelPanel.createOrShow(context.extensionUri, evaluator.getTimeTravelDebugger());
    });
    const clearTimeTravelHistoryCommand = vscode.commands.registerCommand('jsEvaluator.clearTimeTravelHistory', () => {
        evaluator.clearTimeTravelHistory();
        vscode.window.showInformationMessage('Time travel history cleared.');
        // Update the panel if it's open
        if (timeTravelPanel_1.TimeTravelPanel.currentPanel) {
            timeTravelPanel_1.TimeTravelPanel.currentPanel.update();
        }
    });
    // Copy Value Command
    const copyValueCommand = vscode.commands.registerCommand('jsEvaluator.copyValueFromExplorer', async (value) => {
        if (value) {
            await vscode.env.clipboard.writeText(value);
            vscode.window.showInformationMessage('Value copied to clipboard!');
        }
    });
    context.subscriptions.push(evaluateSelectionCommand, startLiveEvaluationCommand, stopLiveEvaluationCommand, clearAllResultsCommand, toggleTimeTravelCommand, showTimeTravelPanelCommand, clearTimeTravelHistoryCommand, copyValueCommand);
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