import * as vm from 'vm';
import * as vscode from 'vscode'; // Added import for vscode types

/**
 * Safely evaluates JavaScript expressions in a sandboxed environment.
 */
export class SafeEvaluator {
  public createContext(logOutput?: (message: string, expressionRange?: vscode.Range) => void): vm.Context {
    // Create a basic context with a custom console.log if a logger is provided
    const sandbox: any = {
      console: {
        log: (message: any, ...optionalParams: any[]) => {
          const output = [message, ...optionalParams].map(m => {
            if (typeof m === 'object') {
              try {
                return JSON.stringify(m, null, 2);
              } catch (e) {
                return '[Unserializable Object]';
              }
            }
            return String(m);
          }).join(' ');

          if (logOutput) {
            // Retrieve the range of the expression that triggered this log
            // It's stored on the 'sandbox' (the VM context) object itself.
            const currentExpressionRange = sandbox.__currentExpressionRange as vscode.Range | undefined;
            logOutput(output, currentExpressionRange);
          } else {
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
  public evaluate(expressionText: string, expressionRange: vscode.Range, context: vm.Context): any {
    // Store the current expression's range on the context so the sandbox logger can access it
    // This is a bit of a hack; a cleaner way might involve a custom VM or more intricate context management.
    (context as any).__currentExpressionRange = expressionRange;

    try {
      const script = new vm.Script(expressionText);
      const result = script.runInContext(context, { timeout: 1000 }); // 1 second timeout
      // For expressions, the result is directly returned. 
      // For statements like assignments (let a = 10), it's undefined.
      return { result };
    } catch (e: any) {
      return { error: e.message || String(e) };
    } finally {
      // It's important to clean up any properties we set on the context if they are temporary
      delete (context as any).__currentExpressionRange;
    }
  }
}
