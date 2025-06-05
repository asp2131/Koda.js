# Technology Stack Guide

## Core Technologies

### VS Code Extension API
- **Version**: 1.74+
- **Purpose**: Extension framework and editor integration
- **Key Modules**:
  - `vscode.window` - Editor access and decorations
  - `vscode.commands` - Command registration
  - `vscode.workspace` - Document management
  - `vscode.languages` - Hover and diagnostic providers
  - `vscode.TextEditor` - Inline decorations and selections

### TypeScript
- **Version**: 4.9+
- **Purpose**: Primary development language with strong typing
- **Configuration**: Strict mode enabled for better code quality
- **Build Tool**: Built-in TypeScript compiler with watch mode

### Node.js
- **Version**: 16+ (LTS)
- **Runtime**: Extension host environment
- **Key Modules**:
  - `vm` - JavaScript execution sandbox
  - `acorn` or built-in parser - AST parsing
  - `util` - Utility functions
  - `events` - Event handling

## Development Tools

### Build System
```json
{
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  }
}
```

### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Testing Framework
- **Mocha**: Test runner
- **@types/mocha**: TypeScript definitions
- **@vscode/test-electron**: VS Code testing utilities

## Project Structure Best Practices

### Recommended Directory Layout
```
vscode-js-evaluator/
├── src/
│   ├── extension.ts              # Main extension entry
│   ├── evaluator/
│   │   ├── engine.ts             # Core evaluation engine
│   │   ├── parser.ts             # AST parsing and analysis
│   │   ├── context.ts            # VM context management
│   │   └── hover.ts              # Hover provider implementation
│   ├── decorations/
│   │   ├── manager.ts            # Decoration lifecycle management
│   │   ├── provider.ts           # Inline decoration provider
│   │   └── styles.ts             # Decoration styling
│   ├── utils/
│   │   ├── logger.ts             # Logging utilities
│   │   ├── config.ts             # Configuration management
│   │   ├── debounce.ts           # Debouncing utilities
│   │   └── types.ts              # Type definitions
│   └── test/
│       ├── suite/
│       │   ├── extension.test.ts
│       │   ├── evaluator.test.ts
│       │   └── decorations.test.ts
│       └── runTest.ts
├── media/                        # Icons and assets
│   ├── icon.png
│   └── demo.gif
├── package.json                  # Extension manifest
├── tsconfig.json                # TypeScript config
├── .vscodeignore               # VS Code packaging ignore
└── README.md
```

## Package.json Configuration

### Essential Extension Manifest
```json
{
  "name": "vscode-js-evaluator",
  "displayName": "JavaScript Evaluator",
  "description": "Inline JavaScript evaluation similar to Quokka.js",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onLanguage:javascript"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "jsEvaluator.startLiveEvaluation",
        "title": "JS Evaluator: Start Live Evaluation"
      },
      {
        "command": "jsEvaluator.stopLiveEvaluation", 
        "title": "JS Evaluator: Stop Live Evaluation"
      },
      {
        "command": "jsEvaluator.evaluateSelection",
        "title": "JS Evaluator: Evaluate Selection"
      }
    ],
    "keybindings": [
      {
        "command": "jsEvaluator.startLiveEvaluation",
        "key": "ctrl+shift+k",
        "mac": "cmd+shift+k",
        "when": "editorLangId == javascript"
      },
      {
        "command": "jsEvaluator.evaluateSelection",
        "key": "ctrl+shift+e",
        "mac": "cmd+shift+e",
        "when": "editorLangId == javascript"
      }
    ],
    "configuration": {
      "title": "JavaScript Evaluator",
      "properties": {
        "jsEvaluator.liveEvaluation": {
          "type": "boolean",
          "default": true,
          "description": "Enable live evaluation as you type"
        },
        "jsEvaluator.evaluationDelay": {
          "type": "number",
          "default": 500,
          "description": "Delay in ms before evaluating after typing stops"
        }
      }
    }
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "@typescript-eslint/eslint-plugin": "^5.45.0",
    "@typescript-eslint/parser": "^5.45.0",
    "eslint": "^8.28.0",
    "typescript": "^4.9.4",
    "@vscode/test-electron": "^2.2.0",
    "mocha": "^10.1.0",
    "@types/mocha": "^10.0.1"
  },
  "dependencies": {
    "acorn": "^8.8.0",
    "@types/acorn": "^4.0.6"
  }
}
```-plugin": "^5.45.0",
    "@typescript-eslint/parser": "^5.45.0",
    "eslint": "^8.28.0",
    "typescript": "^4.9.4",
    "@vscode/test-electron": "^2.2.0",
    "mocha": "^10.1.0",
    "@types/mocha": "^10.0.1"
  }
}
```

## Code Style and Standards

### ESLint Configuration (`.eslintrc.json`)
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 6,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/naming-convention": [
      "warn",
      {
        "selector": "import",
        "format": ["camelCase", "PascalCase"]
      }
    ],
    "curly": "warn",
    "eqeqeq": "warn",
    "no-throw-literal": "warn",
    "semi": "warn"
  }
}
```

### TypeScript Patterns

#### Interface Definitions
```typescript
// src/utils/types.ts
export interface EvaluationResult {
  success: boolean;
  value?: any;
  error?: EvaluationError;
  executionTime: number;
  line: number;
  column: number;
}

export interface EvaluationError {
  message: string;
  type: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface ExpressionInfo {
  text: string;
  range: vscode.Range;
  type: 'expression' | 'statement' | 'declaration';
  dependencies: string[];
}
```

#### Inline Decoration Pattern
```typescript
export class InlineResultDecorator {
  private decorationType: vscode.TextEditorDecorationType;
  
  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em'
      }
    });
  }
  
  updateDecorations(editor: vscode.TextEditor, results: Map<number, any>) {
    const decorations: vscode.DecorationOptions[] = [];
    
    results.forEach((value, line) => {
      decorations.push({
        range: new vscode.Range(line, Number.MAX_VALUE, line, Number.MAX_VALUE),
        renderOptions: {
          after: {
            contentText: ` → ${this.formatValue(value)}`
          }
        }
      });
    });
    
    editor.setDecorations(this.decorationType, decorations);
  }
}
```

## VS Code API Usage Patterns

### Document Change Handling
```typescript
export function activate(context: vscode.ExtensionContext) {
  const evaluator = new JavaScriptEvaluator();
  
  // Register document change listener
  const changeDisposable = vscode.workspace.onDidChangeTextDocument(
    debounce((event) => {
      if (event.document.languageId === 'javascript') {
        evaluator.evaluateDocument(event.document);
      }
    }, 500)
  );
  
  // Register commands
  const startCommand = vscode.commands.registerCommand(
    'jsEvaluator.startLiveEvaluation',
    () => evaluator.startLiveEvaluation()
  );
  
  context.subscriptions.push(changeDisposable, startCommand);
}
```

### AST Parsing Integration
```typescript
import * as acorn from 'acorn';

export class ExpressionParser {
  parseExpressions(code: string): ExpressionInfo[] {
    try {
      const ast = acorn.parse(code, {
        ecmaVersion: 2022,
        sourceType: 'script',
        locations: true
      });
      
      return this.extractExpressions(ast);
    } catch (error) {
      // Handle parsing errors gracefully
      return this.parsePartial(code);
    }
  }
  
  private extractExpressions(node: any): ExpressionInfo[] {
    const expressions: ExpressionInfo[] = [];
    
    // Walk AST and extract evaluable expressions
    this.walkNode(node, expressions);
    
    return expressions;
  }
}
```

### Hover Provider Implementation
```typescript
export class JavaScriptHoverProvider implements vscode.HoverProvider {
  constructor(private evaluator: JavaScriptEvaluator) {}
  
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    
    const range = document.getWordRangeAtPosition(position);
    if (!range) return;
    
    const word = document.getText(range);
    const value = this.evaluator.getVariableValue(word);
    
    if (value !== undefined) {
      const markdown = new vscode.MarkdownString();
      markdown.appendCodeblock(JSON.stringify(value, null, 2), 'json');
      return new vscode.Hover(markdown, range);
    }
  }
}
```

## Security Best Practices

### VM Context Isolation
```typescript
import * as vm from 'vm';

export class SafeEvaluator {
  private context: vm.Context;
  
  constructor() {
    this.context = vm.createContext({
      console: this.createSafeConsole(),
      setTimeout: this.createSafeTimeout(),
      Math: Math,
      Date: Date,
      JSON: JSON,
      // Only expose safe globals
    });
  }
  
  evaluate(expression: string): EvaluationResult {
    try {
      const script = new vm.Script(expression, {
        timeout: 3000,
        displayErrors: true,
        filename: 'evaluation.js'
      });
      
      const result = script.runInContext(this.context);
      return { success: true, value: result };
    } catch (error) {
      return { 
        success: false, 
        error: {
          message: error.message,
          type: error.constructor.name
        }
      };
    }
  }
  
  private createSafeConsole() {
    return {
      log: (...args: any[]) => this.handleConsoleOutput('log', args),
      error: (...args: any[]) => this.handleConsoleOutput('error', args),
      warn: (...args: any[]) => this.handleConsoleOutput('warn', args),
      info: (...args: any[]) => this.handleConsoleOutput('info', args)
    };
  }
}
```

### Expression Safety Validation
```typescript
export class ExpressionValidator {
  private dangerousPatterns = [
    /require\s*\(/,
    /process\./,
    /fs\./,
    /child_process/,
    /__dirname/,
    /__filename/,
    /eval\s*\(/,
    /Function\s*\(/
  ];
  
  isSafe(expression: string): boolean {
    return !this.dangerousPatterns.some(pattern => 
      pattern.test(expression)
    );
  }
}
```

## Performance Considerations

### Debounced Evaluation
```typescript
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout;
  
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

export class DocumentEvaluator {
  private evaluateDebounced = debounce(
    (document: vscode.TextDocument) => this.evaluateDocument(document),
    500
  );
  
  onDocumentChange(event: vscode.TextDocumentChangeEvent) {
    this.evaluateDebounced(event.document);
  }
}
```

### Incremental AST Updates
```typescript
export class IncrementalParser {
  private astCache = new Map<string, any>();
  private lastModified = new Map<string, number>();
  
  parseDocument(document: vscode.TextDocument): any {
    const uri = document.uri.toString();
    const version = document.version;
    
    if (this.lastModified.get(uri) === version) {
      return this.astCache.get(uri);
    }
    
    const ast = this.parse(document.getText());
    this.astCache.set(uri, ast);
    this.lastModified.set(uri, version);
    
    return ast;
  }
}
```

### Memory Management
```typescript
export class ContextManager {
  private contexts = new Map<string, vm.Context>();
  private lastAccess = new Map<string, number>();
  private readonly MAX_CONTEXTS = 5;
  private readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  
  constructor() {
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }
  
  getContext(documentUri: string): vm.Context {
    if (this.contexts.size >= this.MAX_CONTEXTS) {
      this.evictLeastRecentlyUsed();
    }
    
    if (!this.contexts.has(documentUri)) {
      this.contexts.set(documentUri, this.createContext());
    }
    
    this.lastAccess.set(documentUri, Date.now());
    return this.contexts.get(documentUri)!;
  }
  
  private cleanup() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [uri, lastTime] of this.lastAccess) {
      if (now - lastTime > staleThreshold) {
        this.contexts.delete(uri);
        this.lastAccess.delete(uri);
      }
    }
  }
}
```

## Testing Patterns

### Unit Test Structure
```typescript
import * as assert from 'assert';
import { SafeEvaluator } from '../evaluator/engine';
import { ExpressionParser } from '../evaluator/parser';

suite('JavaScript Evaluator Tests', () => {
  let evaluator: SafeEvaluator;
  let parser: ExpressionParser;
  
  setup(() => {
    evaluator = new SafeEvaluator();
    parser = new ExpressionParser();
  });
  
  test('should evaluate simple expressions', () => {
    const result = evaluator.evaluate('1 + 1');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.value, 2);
  });
  
  test('should parse expressions from code', () => {
    const code = 'let x = 5;\nlet y = x + 10;';
    const expressions = parser.parseExpressions(code);
    assert.strictEqual(expressions.length, 2);
    assert.strictEqual(expressions[0].type, 'declaration');
  });
  
  test('should handle evaluation errors gracefully', () => {
    const result = evaluator.evaluate('JSON.parse("invalid")');
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.message.includes('JSON'));
  });
});
```

### Integration Testing
```typescript
suite('Inline Evaluation Integration', () => {
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;
  
  setup(async () => {
    document = await vscode.workspace.openTextDocument({
      language: 'javascript',
      content: 'let x = 5;\nconsole.log(x);'
    });
    editor = await vscode.window.showTextDocument(document);
  });
  
  test('should show inline decorations after evaluation', async () => {
    const evaluator = new DocumentEvaluator();
    await evaluator.evaluateDocument(document);
    
    // Verify decorations are present
    const decorations = editor.visibleRanges;
    assert.ok(decorations.length > 0);
  });
});
```

## Deployment and Distribution

### VS Code Extension Package
```bash
# Install vsce (VS Code Extension CLI)
npm install -g vsce

# Package extension
vsce package

# Publish to marketplace
vsce publish
```

### CI/CD Integration
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      - run: npm ci
      - run: npm run compile
      - run: npm test
```