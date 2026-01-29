# Judge0 Integration Planning Document

## Overview

This document outlines the plan for integrating the self-hosted Judge0 API (`http://64.225.5.178:2358/`) into Koda.js to enable robust code execution with Quokka-style output formatting.

---

## Current Architecture

### Local VM-Based Execution
- **Engine**: `src/evaluator/engine.ts` - Uses Node.js `vm` module for sandboxed execution
- **Parser**: `src/evaluator/parser.ts` - Uses Acorn to parse JS/TS into AST
- **Decorations**: `src/decorations/resultDecorator.ts` - Displays inline results
- **Limitations**: 
  - Local-only execution
  - Limited sandbox security
  - No execution metrics (time, memory)
  - Single-process limitations

---

## Target: Judge0 Remote Execution

### API Endpoint Details
- **Base URL**: `http://64.225.5.178:2358/`
- **Docs**: `http://64.225.5.178:2358/docs`
- **Languages**:
  - JavaScript (Node.js 12.14.0): ID `63`
  - TypeScript (3.7.4): ID `74`

### Key API Endpoints

#### 1. Create Submission (POST `/submissions`)
```http
POST /submissions
Content-Type: application/json

{
  "source_code": "console.log('Hello World');",
  "language_id": 63,
  "stdin": "",
  "cpu_time_limit": 2.0,
  "memory_limit": 128000,
  "redirect_stderr_to_stdout": false
}
```

**Response**: `{ "token": "abc123" }`

#### 2. Get Submission Result (GET `/submissions/{token}`)
```http
GET /submissions/abc123
```

**Response Fields**:
| Field | Description |
|-------|-------------|
| `stdout` | Program output |
| `stderr` | Error output |
| `compile_output` | Compilation errors |
| `message` | System message |
| `time` | Execution time (seconds) |
| `memory` | Memory used (KB) |
| `status` | Execution status object |
| `status.id` | Status code (1-14) |
| `status.description` | Status description |

### Status Codes
| ID | Description |
|----|-------------|
| 1 | In Queue |
| 2 | Processing |
| 3 | Accepted |
| 4 | Wrong Answer |
| 5 | Time Limit Exceeded |
| 6 | Compilation Error |
| 7 | Runtime Error (SIGSEGV) |
| 8 | Runtime Error (SIGXFSZ) |
| 9 | Runtime Error (SIGFPE) |
| 10 | Runtime Error (SIGABRT) |
| 11 | Runtime Error (NZEC) |
| 12 | Runtime Error (Other) |
| 13 | Internal Error |
| 14 | Exec Format Error |

---

## Quokka-Style Output Goals

### Current Koda.js Output
```
let x = 5;           // => undefined
x * 2;               // => 10
console.log(x);      // log: 5
```

### Target Quokka-Style Output
```
let x = 5;                              // > undefined
x * 2;                                  // > 10 [0.1ms]
console.log(x);                         // 5
x + 'test';                             // > "5test"
                                        //   ^ string
// Errors
nonexistent();                          // ● ReferenceError: nonexistent is not defined
                                        //   at <anonymous>:1:1
// Object preview
let obj = { a: 1, b: 2, c: 3 };         // > {a: 1, b: 2, ...}
// Array preview
let arr = [1, 2, 3, 4, 5];              // > [1, 2, 3, 4, 5]
// Performance
heavyCalculation();                     // > 42 [145ms]
```

### Key Quokka Features to Implement
1. **Value Badges**: Blue `>` prefix for values
2. **Execution Time**: `[Xms]` suffix for slow operations (>5ms)
3. **Console Output**: Direct output without prefix (like `log:`)
4. **Error Display**: Red `●` prefix with inline error message
5. **Type Indicators**: Small superscript showing value type
6. **Object Truncation**: Smart truncation for large objects
7. **Live Updates**: Real-time results as you type
8. **Identity Values**: Show `// > undefined` for declarations

---

## Implementation Plan

### Phase 1: Judge0 Client Module

#### New File: `src/judge0/client.ts`
```typescript
interface Judge0Config {
  baseUrl: string;
  apiKey?: string;
}

interface SubmissionRequest {
  source_code: string;
  language_id: number;
  stdin?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  enable_network?: boolean;
}

interface SubmissionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;      // "0.001" (seconds)
  memory: number | null;    // KB
  status: {
    id: number;
    description: string;
  };
}

class Judge0Client {
  constructor(config: Judge0Config);
  
  // Submit code and get token
  async submit(request: SubmissionRequest): Promise<string>;
  
  // Poll for result
  async getResult(token: string): Promise<SubmissionResult>;
  
  // Submit and wait for completion
  async execute(
    sourceCode: string, 
    languageId: number,
    timeout?: number
  ): Promise<SubmissionResult>;
}
```

**Implementation Notes**:
- Handle polling with exponential backoff
- Parse Judge0's ISO 8601 timestamps
- Map status codes to user-friendly messages
- Handle network errors gracefully

### Phase 2: Execution Engine Refactor

#### Modify: `src/evaluator/engine.ts`

**Current Approach**:
```typescript
// VM-based local execution
const context = vm.createContext(sandbox);
result = script.runInContext(context, { timeout: 1000 });
```

**New Approach**:
```typescript
// Judge0 remote execution
async execute(expressionText: string): Promise<ExecutionOutput> {
  // Wrap expression for Judge0
  const wrappedCode = this.wrapForJudge0(expressionText);
  
  const result = await this.judge0.execute(wrappedCode, 63);
  
  return {
    value: this.parseOutput(result.stdout),
    error: this.parseError(result),
    executionTime: parseFloat(result.time || '0') * 1000, // ms
    memory: result.memory,
  };
}

private wrapForJudge0(code: string): string {
  // Wrap to capture return value and serialize for display
  return `
const __result = (() => { ${code} })();
if (__result !== undefined) {
  console.log(JSON.stringify({
    type: typeof __result,
    value: __result,
    isArray: Array.isArray(__result),
    constructor: __result?.constructor?.name
  }));
} else {
  console.log('undefined');
}
  `.trim();
}
```

**Configuration**:
```typescript
// Add to package.json settings
{
  "jsEvaluator.execution.mode": {
    "type": "string",
    "enum": ["local", "judge0"],
    "default": "local",
    "description": "Execution mode: local VM or remote Judge0"
  },
  "jsEvaluator.judge0.url": {
    "type": "string",
    "default": "http://64.225.5.178:2358",
    "description": "Judge0 API base URL"
  },
  "jsEvaluator.judge0.apiKey": {
    "type": "string",
    "default": "",
    "description": "Judge0 API key (if authentication enabled)"
  }
}
```

### Phase 3: Quokka-Style Decorations

#### Modify: `src/decorations/resultDecorator.ts`

**New Decoration Types**:
```typescript
export class ResultDecorator {
  // Value results: Blue > prefix
  private valueDecorationType: vscode.TextEditorDecorationType;
  
  // Console output: No prefix, distinct style
  private consoleDecorationType: vscode.TextEditorDecorationType;
  
  // Errors: Red ● prefix
  private errorDecorationType: vscode.TextEditorDecorationType;
  
  // Performance indicator: Small [Xms] suffix
  private performanceDecorationType: vscode.TextEditorDecorationType;
  
  // Type annotations: Superscript style
  private typeAnnotationType: vscode.TextEditorDecorationType;

  constructor() {
    // Value: Blue italic with > prefix
    this.valueDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#569CD6', // VS Code blue
        fontStyle: 'italic',
        fontWeight: 'normal',
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
    });

    // Console: Gray, direct output
    this.consoleDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#808080', // Gray
        fontStyle: 'normal',
      },
    });

    // Error: Red with ● prefix
    this.errorDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#F48771', // VS Code error red
        fontStyle: 'italic',
      },
      isWholeLine: false,
    });

    // Performance: Small, subtle [Xms]
    this.performanceDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: '#6A9955', // Green for performance
        fontSize: '0.85em',
        fontStyle: 'italic',
      },
    });
  }
}
```

**Enhanced Display Logic**:
```typescript
interface QuokkaStyleResult {
  text: string;
  originalRange: vscode.Range;
  type: 'value' | 'console' | 'error' | 'performance';
  executionTime?: number;  // milliseconds
  valueType?: string;      // 'number', 'string', 'object', etc.
  isTruncated?: boolean;
}

public displayQuokkaResults(editor: vscode.TextEditor, results: QuokkaStyleResult[]) {
  const decorations = {
    value: [],
    console: [],
    error: [],
    performance: [],
  };

  for (const result of results) {
    const formatted = this.formatForQuokka(result);
    decorations[result.type].push(formatted);
  }

  // Apply each decoration type
  editor.setDecorations(this.valueDecorationType, decorations.value);
  editor.setDecorations(this.consoleDecorationType, decorations.console);
  editor.setDecorations(this.errorDecorationType, decorations.error);
  editor.setDecorations(this.performanceDecorationType, decorations.performance);
}

private formatForQuokka(result: QuokkaStyleResult): vscode.DecorationOptions {
  let contentText: string;
  
  switch (result.type) {
    case 'value':
      contentText = ` // > ${this.truncate(result.text, 50)}`;
      break;
    case 'console':
      contentText = ` // ${result.text}`;
      break;
    case 'error':
      contentText = ` // ● ${result.text}`;
      break;
    case 'performance':
      contentText = ` [${result.executionTime?.toFixed(1)}ms]`;
      break;
  }

  return {
    range: result.originalRange,
    renderOptions: {
      after: { contentText },
    },
  };
}
```

### Phase 4: Smart Output Formatting

#### New File: `src/utils/valueFormatter.ts`
```typescript
export class ValueFormatter {
  private static MAX_LENGTH = 50;
  private static MAX_ARRAY_ITEMS = 5;
  private static MAX_OBJECT_KEYS = 3;

  static format(value: any, type: string): string {
    switch (type) {
      case 'undefined':
        return 'undefined';
      
      case 'number':
      case 'boolean':
        return String(value);
      
      case 'string':
        return this.formatString(value);
      
      case 'object':
        if (value === null) return 'null';
        if (Array.isArray(value)) return this.formatArray(value);
        return this.formatObject(value);
      
      case 'function':
        return 'ƒ';
      
      default:
        return String(value);
    }
  }

  private static formatString(str: string): string {
    const truncated = str.length > this.MAX_LENGTH 
      ? str.slice(0, this.MAX_LENGTH) + '...'
      : str;
    return `"${truncated}"`;
  }

  private static formatArray(arr: any[]): string {
    if (arr.length === 0) return '[]';
    if (arr.length <= this.MAX_ARRAY_ITEMS) {
      return `[${arr.map(v => this.format(v, typeof v)).join(', ')}]`;
    }
    const items = arr.slice(0, this.MAX_ARRAY_ITEMS)
      .map(v => this.format(v, typeof v))
      .join(', ');
    return `[${items}, ...+${arr.length - this.MAX_ARRAY_ITEMS} more]`;
  }

  private static formatObject(obj: object): string {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    
    const shownKeys = keys.slice(0, this.MAX_OBJECT_KEYS);
    const keyValues = shownKeys.map(k => {
      const val = (obj as any)[k];
      const formatted = this.format(val, typeof val);
      return `${k}: ${formatted}`;
    }).join(', ');
    
    if (keys.length > this.MAX_OBJECT_KEYS) {
      return `{${keyValues}, ...+${keys.length - this.MAX_OBJECT_KEYS} more}`;
    }
    return `{${keyValues}}`;
  }
}
```

### Phase 5: Console Output Handling

#### Challenge
Judge0 returns `stdout` as a single string. Need to parse console.log outputs and associate with expressions.

#### Solution: Marked Console Output
```typescript
// In wrapped code for Judge0
const WRAP_CODE = `
const __outputs = [];
const originalLog = console.log;
console.log = (...args) => {
  __outputs.push(args.map(a => 
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' '));
  originalLog.apply(console, args);
};

try {
  const __result = (() => { 
    __USER_CODE__ 
  })();
  
  console.log('__JUDGE0_RESULT_START__');
  console.log(JSON.stringify({
    outputs: __outputs,
    result: __result,
    resultType: typeof __result,
    isArray: Array.isArray(__result),
    isNull: __result === null
  }));
  console.log('__JUDGE0_RESULT_END__');
} catch (e) {
  console.log('__JUDGE0_ERROR__');
  console.log(e.message);
  console.log(e.stack);
}
`;
```

### Phase 6: Error Handling

#### Parse Judge0 Errors
```typescript
function parseJudge0Error(result: SubmissionResult): string {
  // Compilation error (TypeScript)
  if (result.compile_output) {
    return `Compilation Error: ${result.compile_output}`;
  }
  
  // Runtime error
  if (result.stderr) {
    return result.stderr;
  }
  
  // Status-based errors
  switch (result.status.id) {
    case 5:
      return `Time Limit Exceeded (${result.time}s)`;
    case 6:
      return `Compilation Error`;
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
      return `Runtime Error: ${result.status.description}`;
    case 13:
      return `Internal Error - Please try again`;
    default:
      return result.message || 'Unknown error';
  }
}
```

### Phase 7: UI Enhancements

#### Status Bar Integration
```typescript
// Show Judge0 connection status
private updateJudge0StatusBar(result?: SubmissionResult) {
  if (!result) {
    this.statusBarItem.text = "$(sync~spin) Connecting to Judge0...";
    return;
  }
  
  const time = parseFloat(result.time || '0') * 1000;
  const memory = result.memory || 0;
  
  this.statusBarItem.text = `$(zap) ${time.toFixed(0)}ms ${(memory/1024).toFixed(1)}MB`;
  this.statusBarItem.tooltip = `Execution time: ${time}ms\nMemory used: ${memory}KB`;
}
```

#### Progress Indicators
```typescript
// Show inline progress for long-running operations
private showProgressDecoration(range: vscode.Range) {
  const decoration: vscode.DecorationOptions = {
    range,
    renderOptions: {
      after: { contentText: ' // ⏳ ...' },
    },
  };
  this.progressDecorationType.setDecorations([decoration]);
}
```

---

## Migration Strategy

### Phase 1: Parallel Execution (Week 1)
- Create Judge0 client module
- Add configuration settings
- Implement fallback to local VM if Judge0 unavailable
- Feature flag: `jsEvaluator.execution.mode`

### Phase 2: Enhanced Output (Week 2)
- Implement Quokka-style decorations
- Add execution time display
- Improve object/array formatting
- Add console output handling

### Phase 3: TypeScript Support (Week 3)
- Add TypeScript compilation step
- Use language_id 74 for .ts files
- Handle compilation errors gracefully
- Source map support for error line numbers

### Phase 4: Polish (Week 4)
- Performance optimizations (batch submissions)
- Caching for repeated evaluations
- Better error messages
- Documentation updates

---

## File Changes Summary

### New Files
```
src/
├── judge0/
│   ├── client.ts           # HTTP client for Judge0 API
│   ├── types.ts            # TypeScript interfaces
│   └── errorHandler.ts     # Error parsing utilities
├── utils/
│   ├── valueFormatter.ts   # Smart value formatting
│   └── consoleParser.ts    # Parse console.log outputs
```

### Modified Files
```
src/
├── extension.ts            # Add Judge0 configuration
├── evaluator/
│   ├── engine.ts           # Add remote execution mode
│   └── parser.ts           # Minor updates for TS
└── decorations/
    └── resultDecorator.ts  # Quokka-style decorations
```

---

## Configuration Settings

Add to `package.json`:

```json
{
  "jsEvaluator.execution.mode": {
    "type": "string",
    "enum": ["local", "judge0", "auto"],
    "default": "auto",
    "description": "Code execution mode. 'auto' uses Judge0 for complex operations, local for simple expressions."
  },
  "jsEvaluator.judge0.url": {
    "type": "string",
    "default": "http://64.225.5.178:2358",
    "description": "Judge0 API base URL"
  },
  "jsEvaluator.judge0.apiKey": {
    "type": "string",
    "default": "",
    "description": "API key for authenticated Judge0 instances"
  },
  "jsEvaluator.judge0.timeout": {
    "type": "number",
    "default": 5000,
    "description": "Maximum execution time in milliseconds"
  },
  "jsEvaluator.judge0.memoryLimit": {
    "type": "number",
    "default": 128000,
    "description": "Memory limit in KB"
  },
  "jsEvaluator.display.showExecutionTime": {
    "type": "boolean",
    "default": true,
    "description": "Show execution time for expressions"
  },
  "jsEvaluator.display.showMemoryUsage": {
    "type": "boolean",
    "default": false,
    "description": "Show memory usage in status bar"
  },
  "jsEvaluator.display.quokkaStyle": {
    "type": "boolean",
    "default": true,
    "description": "Use Quokka.js-style output formatting"
  }
}
```

---

## Testing Plan

### Unit Tests
1. Judge0 client HTTP mocking
2. Value formatting edge cases
3. Error parsing scenarios
4. Decoration range calculations

### Integration Tests
1. End-to-end JavaScript execution
2. TypeScript compilation and execution
3. Console output capture
4. Error propagation

### Manual Testing Scenarios
1. Simple expressions: `1 + 1`
2. Variable declarations: `let x = 5`
3. Console logs: `console.log("test")`
4. Objects: `{ a: 1, b: 2 }`
5. Arrays: `[1, 2, 3, 4, 5]`
6. Errors: `throw new Error("test")`
7. Infinite loops: `while(true) {}`
8. Large outputs: `console.log("x".repeat(10000))`

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Judge0 server down | Fallback to local VM mode |
| Network latency | Add timeout and caching |
| Execution timeouts | Clear error messages, suggest increasing timeout |
| Memory limits | Document limits, suggest optimization |
| TypeScript errors | Show compilation output inline |
| Breaking changes | Feature flags for gradual rollout |

---

## Success Metrics

1. **Performance**: Average execution time < 2s for simple expressions
2. **Reliability**: 99% uptime for Judge0 integration
3. **User Experience**: Feature parity with Quokka.js basic features
4. **Adoption**: Users actively switch to Judge0 mode

---

## Future Enhancements

1. **Multi-file support**: Judge0 supports additional_files
2. **Custom npm packages**: Pre-install popular packages
3. **Collaborative sessions**: Share execution results
4. **Execution history**: Persist results across sessions
5. **Performance profiling**: Flame graphs for code

---

## References

- [Judge0 API Docs](http://64.225.5.178:2358/docs)
- [Quokka.js Features](https://quokkajs.com/docs/)
- [VS Code Decoration API](https://code.visualstudio.com/api/references/vscode-api#TextEditorDecorationType)
- [Judge0 GitHub](https://github.com/judge0/judge0)
