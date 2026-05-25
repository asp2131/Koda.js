import * as vscode from 'vscode';
import * as acorn from 'acorn'; // Import acorn for type assertions
import * as util from 'util';
import { ExpressionParser, ExpressionInfo, ParseResult } from './evaluator/parser';
import { SafeEvaluator } from './evaluator/engine';
import { ResultDecorator, EvaluationResultDisplay } from './decorations/resultDecorator';
import { TimeTravelPanel } from './ui/timeTravelPanel';
import { EvaluationHoverProvider } from './providers/hoverProvider';
import { ValueExplorerProvider } from './providers/valueExplorerProvider';

// Global state for live evaluation
let isLiveEvaluationActive: boolean = false;
let textDocumentChangeDisposable: vscode.Disposable | undefined;
let liveEvaluationStatusBarItem: vscode.StatusBarItem;
let debounceTimer: NodeJS.Timeout | undefined;

// Global diagnostics collection, initialized in activate
let diagnostics: vscode.DiagnosticCollection;

// Time travel debugging state
let isTimeTravelEnabled: boolean = false;
let timeTravelStatusBarItem: vscode.StatusBarItem;

async function evaluateEditor(
    editor: vscode.TextEditor,
    parser: ExpressionParser,
    evaluator: SafeEvaluator,
    resultDecorator: ResultDecorator,
    currentDiagnostics: vscode.DiagnosticCollection,
    valueExplorerProvider?: ValueExplorerProvider
) {
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
    const parseOutput: ParseResult = parser.parseDocument(document);
    const expressions: ExpressionInfo[] = parseOutput.expressions;
    const liveComments = parseOutput.liveComments;
    const syntaxDiagnosticsFromParser: vscode.Diagnostic[] = parseOutput.diagnostics;

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

    const displayableResults: EvaluationResultDisplay[] = [];
    const evaluationContext = evaluator.createContext((logMessage: string, expressionRange?: vscode.Range) => {
        if (expressionRange) {
            displayableResults.push({
                text: logMessage,
                fullText: logMessage,
                originalRange: expressionRange,
                isLog: true,
                valueType: 'string'
            });
        } else {
            console.log(`[Sandbox Log - Unassociated in evaluateEditor]: ${logMessage}`);
        }
    });

    for (const expr of expressions) { // Using for...of for cleaner iteration
        try {
            (evaluationContext as any).__currentExpressionRange = expr.range;
            // Corrected argument order and variable name for evaluation output
            const evaluationOutput = evaluator.evaluate(expr.text, expr.range, evaluationContext);
            delete (evaluationContext as any).__currentExpressionRange;

            if (evaluationOutput.error) {
                displayableResults.push({
                    text: evaluationOutput.error,
                    fullText: evaluationOutput.error,
                    originalRange: expr.range,
                    isError: true,
                    valueType: 'error'
                });
            } else {
                let isConsoleLogCall = false;
                const node = expr.node; // node is acorn.Node
                if (node.type === 'ExpressionStatement') {
                    // Type assertion for ExpressionStatement
                    const expressionStatement = node as acorn.ExpressionStatement;
                    if (expressionStatement.expression.type === 'CallExpression') {
                        // Type assertion for CallExpression
                        const callExpression = expressionStatement.expression as acorn.CallExpression;
                        if (callExpression.callee.type === 'MemberExpression') {
                            // Type assertion for MemberExpression
                            const memberExpression = callExpression.callee as acorn.MemberExpression;
                            if (memberExpression.object.type === 'Identifier') {
                                // Type assertion for Identifier
                                const identifier = memberExpression.object as acorn.Identifier;
                                if (identifier.name === 'console') {
                                    isConsoleLogCall = true;
                                }
                            }
                        }
                    }
                }

                if (evaluationOutput.result !== undefined && !isConsoleLogCall) {
                    const result = evaluationOutput.result;
                    let resultText: string;
                    let fullResultText: string;
                    let valueType: string;
                    
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
                    } else {
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
        } catch (e: any) {
            console.error(`[evaluateEditor] Error evaluating expression '${expr.text}':`, e);
            delete (evaluationContext as any).__currentExpressionRange; // Ensure cleanup on error too
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
            } else {
                let resultText: string;
                let fullResultText: string;
                let valueType: string;

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
                } else {
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
        } catch (e: any) {
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

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-js-evaluator" is now active!');

    diagnostics = vscode.languages.createDiagnosticCollection("javascriptEvaluator");
    context.subscriptions.push(diagnostics);

    const parser = new ExpressionParser();
    const evaluator = new SafeEvaluator();
    const resultDecorator = new ResultDecorator();

    // Register hover provider for full value display
    const hoverProvider = new EvaluationHoverProvider(resultDecorator);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(['javascript', 'typescript'], hoverProvider)
    );

    // Register Value Explorer
    const valueExplorerProvider = new ValueExplorerProvider();
    vscode.window.registerTreeDataProvider('kodaValueExplorer', valueExplorerProvider);

    liveEvaluationStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(liveEvaluationStatusBarItem);

    // Initialize time travel status bar item
    timeTravelStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    timeTravelStatusBarItem.command = 'jsEvaluator.showTimeTravelPanel';
    context.subscriptions.push(timeTravelStatusBarItem);

    // Enhanced text document change handler with time travel integration
    const enhancedTextDocumentChange = (event: vscode.TextDocumentChangeEvent) => {
        if (isLiveEvaluationActive && event.document === vscode.window.activeTextEditor?.document) {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(async () => {
                const currentEditor = vscode.window.activeTextEditor;
                if (currentEditor) {
                    await evaluateEditor(currentEditor, parser, evaluator, resultDecorator, diagnostics, valueExplorerProvider);
                    
                    // Update time travel panel if open
                    if (TimeTravelPanel.currentPanel && isTimeTravelEnabled) {
                        TimeTravelPanel.currentPanel.update();
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
        } else {
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
            TimeTravelPanel.createOrShow(context.extensionUri, evaluator.getTimeTravelDebugger());
        } else {
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
        TimeTravelPanel.createOrShow(context.extensionUri, evaluator.getTimeTravelDebugger());
    });

    const clearTimeTravelHistoryCommand = vscode.commands.registerCommand('jsEvaluator.clearTimeTravelHistory', () => {
        evaluator.clearTimeTravelHistory();
        vscode.window.showInformationMessage('Time travel history cleared.');
        
        // Update the panel if it's open
        if (TimeTravelPanel.currentPanel) {
            TimeTravelPanel.currentPanel.update();
        }
    });

    // Copy Value Command
    const copyValueCommand = vscode.commands.registerCommand('jsEvaluator.copyValueFromExplorer', async (value: string) => {
        if (value) {
            await vscode.env.clipboard.writeText(value);
            vscode.window.showInformationMessage('Value copied to clipboard!');
        }
    });

    context.subscriptions.push(
        evaluateSelectionCommand, 
        startLiveEvaluationCommand, 
        stopLiveEvaluationCommand,
        clearAllResultsCommand,
        toggleTimeTravelCommand,
        showTimeTravelPanelCommand,
        clearTimeTravelHistoryCommand,
        copyValueCommand
    );
}

export function deactivate() {
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
