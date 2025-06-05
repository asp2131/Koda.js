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
const resultDecorator_1 = require("./decorations/resultDecorator"); // Import decorator
// This diagnostic collection will be used to display errors in the editor
let diagnosticCollection;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vscode-js-evaluator" is now active!');
    // Create a diagnostic collection for our extension
    diagnosticCollection = vscode.languages.createDiagnosticCollection('javascriptEvaluator');
    context.subscriptions.push(diagnosticCollection); // Ensure it's disposed when the extension deactivates
    // Initialize the parser
    const parser = new parser_1.ExpressionParser();
    // Initialize the evaluator
    const evaluator = new engine_1.SafeEvaluator();
    // Initialize the result decorator
    const resultDecorator = new resultDecorator_1.ResultDecorator();
    context.subscriptions.push(resultDecorator); // Ensure it's disposed
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposableStart = vscode.commands.registerCommand('jsEvaluator.startLiveEvaluation', () => {
        // The code you place here will be executed every time your command is executed
        vscode.window.showInformationMessage('JS Evaluator: Live Evaluation Started!');
    });
    let disposableStop = vscode.commands.registerCommand('jsEvaluator.stopLiveEvaluation', () => {
        vscode.window.showInformationMessage('JS Evaluator: Live Evaluation Stopped!');
    });
    let disposableEvaluate = vscode.commands.registerCommand('jsEvaluator.evaluateSelection', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            // Clear previous diagnostics for this document
            diagnosticCollection.delete(document.uri);
            // Clear previous result decorations
            resultDecorator.clearDecorations(editor);
            // Parse the whole document
            const parseResult = parser.parseDocument(document);
            // Add new diagnostics, if any
            if (parseResult.diagnostics.length > 0) {
                diagnosticCollection.set(document.uri, parseResult.diagnostics);
            }
            // Log the parsed expressions to the console (for debugging)
            console.log(`Parsed expressions:`, parseResult.expressions);
            if (parseResult.diagnostics.length > 0) {
                vscode.window.showWarningMessage(`Found ${parseResult.diagnostics.length} syntax problem(s). Evaluation skipped. Check 'Problems' panel.`);
            }
            else if (parseResult.expressions.length > 0) {
                vscode.window.showInformationMessage(`Parsed ${parseResult.expressions.length} expressions. Evaluating...`);
                const displayableResults = [];
                // Create a single context for this evaluation session.
                // The logOutput callback will now receive the range of the expression that triggered the log.
                const evaluationContext = evaluator.createContext((logMessage, expressionRange) => {
                    console.log(`[Sandbox Log]: ${logMessage}`);
                    if (expressionRange) {
                        displayableResults.push({
                            text: logMessage,
                            originalRange: expressionRange,
                            isLog: true,
                        });
                    }
                    else {
                        // Log message couldn't be associated with a specific expression range
                        // This might happen if console.log is called from a deeply nested async callback not directly tied to an expression's execution scope
                        // Or if the __currentExpressionRange wasn't set/cleared properly in a complex scenario.
                        // For now, these will just go to the DevTools console.
                        console.log(`[Sandbox Log - Unassociated]: ${logMessage}`);
                    }
                });
                // Evaluate each expression in the same context
                parseResult.expressions.forEach((expr, index) => {
                    console.log(`Evaluating expression #${index + 1}: '${expr.text}'`);
                    // Pass the expression text, its range, and the shared context to each evaluation call
                    const evaluationResult = evaluator.evaluate(expr.text, expr.range, evaluationContext);
                    // Check if the expression is a console.log call. 
                    // We generally don't display the result of `console.log()` itself (which is `undefined`)
                    // as its output is handled by the logger in `createContext`.
                    const isConsoleLogCall = expr.text.trim().startsWith('console.log(');
                    if (evaluationResult.error) {
                        console.error(`Error evaluating expression #${index + 1} ('${expr.text}'):`, evaluationResult.error);
                        displayableResults.push({
                            text: String(evaluationResult.error),
                            originalRange: expr.range,
                            isError: true,
                        });
                    }
                    else {
                        console.log(`Result for expression #${index + 1} ('${expr.text}'):`, evaluationResult.result);
                        // Only display a result if it's not undefined and not a console.log call itself
                        if (evaluationResult.result !== undefined && !isConsoleLogCall) {
                            displayableResults.push({
                                text: String(evaluationResult.result),
                                originalRange: expr.range,
                            });
                        }
                    }
                });
                console.log('[Extension] displayableResults count before calling decorator:', displayableResults.length);
                if (displayableResults.length > 0) {
                    // Sort results by line number to ensure decorations are processed in order, though VS Code might handle this.
                    displayableResults.sort((a, b) => a.originalRange.start.line - b.originalRange.start.line);
                    console.log('[Extension] displayableResults content before calling decorator:', JSON.stringify(displayableResults, null, 2));
                    resultDecorator.displayResults(editor, displayableResults);
                }
                else {
                    console.log('[Extension] No displayable results to send to decorator.');
                }
            }
            else {
                vscode.window.showInformationMessage('No expressions found to evaluate.');
            }
        }
        else {
            vscode.window.showWarningMessage('No active editor found to evaluate JavaScript.');
        }
    });
    let disposableClear = vscode.commands.registerCommand('jsEvaluator.clearAllResults', () => {
        vscode.window.showInformationMessage('JS Evaluator: All results cleared (placeholder)!');
    });
    context.subscriptions.push(disposableStart, disposableStop, disposableEvaluate, disposableClear);
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() {
    console.log('Your extension "vscode-js-evaluator" is now deactivated.');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map