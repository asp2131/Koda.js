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
const liveRunner_1 = require("./evaluator/liveRunner");
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
// Single shared runner: instruments + executes the whole file once per evaluation.
const liveRunner = new liveRunner_1.LiveRunner();
/**
 * Collapse captured records by source line (Quokka-style): keep every value for a
 * line, show the latest inline with a ×N badge for repeats (loops), and place all
 * values in the hover text.
 */
function recordsToDisplay(records, document) {
    const byLine = new Map();
    for (const r of records) {
        if (r.line < 1 || r.line > document.lineCount) {
            continue;
        }
        const list = byLine.get(r.line);
        if (list) {
            list.push(r);
        }
        else {
            byLine.set(r.line, [r]);
        }
    }
    const out = [];
    for (const [line, recs] of byLine) {
        const lineIdx = line - 1;
        const range = new vscode.Range(lineIdx, 0, lineIdx, document.lineAt(lineIdx).text.length);
        const last = recs[recs.length - 1];
        const badge = recs.length > 1 ? ` (×${recs.length})` : '';
        out.push({
            text: last.short + badge,
            fullText: recs.map(r => r.full).join('\n'),
            originalRange: range,
            isLog: last.kind === 'log',
            isError: last.kind === 'error',
            valueType: last.valueType
        });
    }
    return out;
}
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
    // Parse only for syntax diagnostics; execution is handled by the runner.
    const parseOutput = parser.parseDocument(document);
    const syntaxDiagnosticsFromParser = parseOutput.diagnostics;
    if (syntaxDiagnosticsFromParser.length > 0) {
        const enhancedDiagnostics = syntaxDiagnosticsFromParser.map(diagnostic => ({
            ...diagnostic,
            source: 'JavaScript Evaluator',
            severity: vscode.DiagnosticSeverity.Error
        }));
        currentDiagnostics.set(document.uri, enhancedDiagnostics);
        resultDecorator.displaySyntaxErrors(editor, enhancedDiagnostics);
        if (!isLiveEvaluationActive) {
            vscode.window.showErrorMessage('Syntax errors found. See Problems panel and inline decorations.');
        }
        return;
    }
    // Single-pass execution: instrument the whole file and run it once in a real
    // Node child process. Captures values, console output, and async results.
    const config = vscode.workspace.getConfiguration('jsEvaluator');
    let runResult;
    try {
        runResult = await liveRunner.run(document.getText(), {
            cwd: vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath,
            timeoutMs: config.get('executionTimeout', 3000)
        });
    }
    catch (e) {
        // Instrumentation failure that slipped past the parser diagnostics.
        console.error('[evaluateEditor] Run failed:', e);
        return;
    }
    const displayableResults = recordsToDisplay(runResult.records, document);
    if (runResult.timedOut && isLiveEvaluationActive) {
        liveEvaluationStatusBarItem.text = '$(warning) JS Live (timed out)';
    }
    else if (isLiveEvaluationActive) {
        liveEvaluationStatusBarItem.text = '$(zap) JS Live';
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