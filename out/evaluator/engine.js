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
exports.SafeEvaluator = void 0;
const vm = __importStar(require("vm"));
const timeTravel_1 = require("./timeTravel");
/**
 * Safely evaluates JavaScript expressions in a sandboxed environment with time travel debugging support.
 */
class SafeEvaluator {
    constructor() {
        this.isTimeTravelEnabled = false;
        this.timeTravelDebugger = new timeTravel_1.TimeTravelDebugger();
    }
    // Time travel control methods
    enableTimeTravel() {
        this.isTimeTravelEnabled = true;
    }
    disableTimeTravel() {
        this.isTimeTravelEnabled = false;
    }
    getTimeTravelDebugger() {
        return this.timeTravelDebugger;
    }
    clearTimeTravelHistory() {
        this.timeTravelDebugger.clearHistory();
    }
    createContext(logOutput) {
        // Create a basic context with a custom console.log if a logger is provided
        const sandbox = {
            console: {
                log: (message, ...optionalParams) => {
                    const output = [message, ...optionalParams].map(m => {
                        if (typeof m === 'object') {
                            try {
                                return JSON.stringify(m, null, 2);
                            }
                            catch (e) {
                                return '[Unserializable Object]';
                            }
                        }
                        return String(m);
                    }).join(' ');
                    if (logOutput) {
                        // Retrieve the range of the expression that triggered this log
                        // It's stored on the 'sandbox' (the VM context) object itself.
                        const currentExpressionRange = sandbox.__currentExpressionRange;
                        logOutput(output, currentExpressionRange);
                    }
                    else {
                        // Fallback to actual console.log if no custom logger, for internal debugging
                        // In a real scenario, direct console.log from sandbox might be restricted
                        console.log('[Sandbox]:', output);
                    }
                },
                // We can add more console methods (error, warn, etc.) as needed
            },
            // You can add other globals here that you want to be available in the sandbox
            // e.g., setTimeout, clearTimeout, etc. but be careful about security.
        };
        return vm.createContext(sandbox);
    }
    /**
     * Evaluates a given JavaScript expression string in a sandboxed context.
     * @param expression The JavaScript expression string to evaluate.
     * @param onLogMessage A callback to handle messages from console.log within the sandbox.
     * @returns The result of the evaluation or an error object if evaluation fails.
     */
    /**
     * Evaluates a given JavaScript expression string in the provided sandboxed context.
     * @param expressionText The JavaScript expression string to evaluate.
     * @param expressionRange The range of this expression in the original document.
     * @param context The V8 VM context to execute the code in.
     * @returns The result of the evaluation or an error object if evaluation fails.
     */
    evaluate(expressionText, expressionRange, context) {
        // Store the current expression's range on the context so the sandbox logger can access it
        context.__currentExpressionRange = expressionRange;
        let result;
        let error;
        try {
            const script = new vm.Script(expressionText);
            result = script.runInContext(context, { timeout: 1000 }); // 1 second timeout
        }
        catch (e) {
            // Format error with stack trace information
            let errorMessage = e.message || String(e);
            // If there's a stack trace, include it in the error
            if (e.stack) {
                // Clean up the stack trace to make it more readable
                const stackLines = e.stack.split('\n');
                // Filter out internal VM frames and keep only relevant lines
                const relevantStack = stackLines.filter((line) => {
                    return !line.includes('at Script.runInContext') &&
                        !line.includes('at createScript') &&
                        !line.includes('at Object.runInContext');
                });
                if (relevantStack.length > 1) {
                    errorMessage = `${errorMessage}\n\nStack trace:\n${relevantStack.slice(1).join('\n')}`;
                }
            }
            error = errorMessage;
        }
        finally {
            // Clean up the temporary range property
            delete context.__currentExpressionRange;
        }
        // Record execution step for time travel debugging if enabled
        if (this.isTimeTravelEnabled) {
            console.log('[TimeTravelDebugger] Recording step for:', expressionText);
            this.timeTravelDebugger.recordStep(expressionText, expressionRange, result, context, error);
        }
        return error ? { error } : { result };
    }
}
exports.SafeEvaluator = SafeEvaluator;
//# sourceMappingURL=engine.js.map