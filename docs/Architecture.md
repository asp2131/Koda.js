# Architecture Documentation

## System Overview

The VS Code JavaScript Evaluator Extension follows an inline evaluation architecture similar to Quokka.js, where JavaScript code is executed and results are displayed directly in the editor using decorations and hover providers.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
├─────────────────────────────────────────────────────────────┤
│  Extension Manager                                          │
│  ├── Command Registration                                   │
│  ├── Document Event Listeners                              │
│  ├── Decoration Manager                                     │
│  └── Lifecycle Management                                   │
├─────────────────────────────────────────────────────────────┤
│  JavaScript Evaluation Engine                              │
│  ├── AST Parser & Analyzer                                 │
│  ├── VM Context Manager                                    │
│  ├── Expression Evaluator                                  │
│  ├── Error Handler                                         │
│  └── Result Formatter                                      │
├─────────────────────────────────────────────────────────────┤
│  UI Integration Layer                                      │
│  ├── Inline Decorations                                    │
│  ├── Hover Providers                                       │
│  ├── Diagnostic Provider                                   │
│  └── Status Bar Integration                                │
└─────────────────────────────────────────────────────────────┘
                              │
                      VS Code Editor API
                              │
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Editor                         │
├─────────────────────────────────────────────────────────────┤
│  Text Document                                             │
│  ├── JavaScript Source Code                               │
│  ├── Inline Result Decorations                            │
│  ├── Error Underlines                                     │
│  └── Hover Tooltips                                       │
├─────────────────────────────────────────────────────────────┤
│  Editor Features                                           │
│  ├── Syntax Highlighting                                  │
│  ├── Real-time Evaluation                                 │
│  ├── Expression Selection                                 │
│  └── Variable Inspection                                  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Extension Host (Node.js)

#### Extension Manager (`src/extension.ts`)
- **Responsibility**: Main entry point, manages document watchers and evaluation lifecycle
- **Key Functions**:
  - `activate()`: Initialize extension and register providers
  - `deactivate()`: Cleanup resources and contexts
  - Document change event handling
  - Command registration for manual evaluation

#### JavaScript Evaluation Engine (`src/evaluator/engine.ts`)
- **Responsibility**: Parse and execute JavaScript code safely
- **Key Components**:
  - **AST Parser**: Parse JavaScript into expressions and statements
  - **VM Context**: Isolated execution environment using Node.js `vm` module
  - **Expression Evaluator**: Evaluate individual expressions and statements
  - **Dependency Tracker**: Track variable dependencies for incremental evaluation

#### Decoration Manager (`src/decorations/manager.ts`)
- **Responsibility**: Manage inline result display and editor decorations
- **Key Functions**:
  - Create and update inline decorations for results
  - Handle error highlighting and underlines
  - Manage decoration lifecycle and cleanup
  - Coordinate with hover providers

### Editor Integration

#### Inline Decorations (`src/decorations/provider.ts`)
- **Responsibility**: Display evaluation results directly in the editor
- **Components**:
  - Result decorations (showing values after expressions)
  - Error decorations (red underlines for errors)
  - Loading decorations (for async operations)
  - Customizable styling and positioning

#### Hover Provider (`src/evaluator/hover.ts`)
- **Responsibility**: Show detailed value information on hover
- **Features**:
  - Variable value inspection
  - Object property exploration
  - Function signature display
  - Error details and stack traces

## Data Flow

### Live Evaluation Flow
```
Text Change → Debounce → Parse AST → Identify Expressions → Execute → Display Results
```

1. **Document Change**: User types in JavaScript file
2. **Debounced Parsing**: After brief delay, parse document into AST
3. **Expression Identification**: Find evaluable expressions and statements
4. **Incremental Execution**: Execute only changed expressions using VM context
5. **Result Formatting**: Format results for inline display
6. **Decoration Update**: Update editor decorations with new results

### Manual Evaluation Flow
```
Command/Selection → Parse Target → Execute → Display → Update Context
```

1. **User Action**: Manual evaluation command or selection evaluation
2. **Target Parsing**: Parse selected code or current expression
3. **Context Execution**: Run code in current VM context
4. **Result Display**: Show result inline or in hover tooltip
5. **Context Update**: Update VM context with new variables/state

### State Management
```
Extension State:
├── Document Contexts (per file)
│   ├── VM Context (variables, functions)
│   ├── AST Cache
│   ├── Evaluation Results
│   └── Error States
├── Global Configuration
│   ├── Evaluation Mode (live/manual)
│   ├── Display Preferences
│   └── Performance Settings
└── UI State
    ├── Active Decorations
    ├── Hover Data Cache
    └── Status Indicators
```

## Security Considerations

### Sandboxing Strategy
- **VM Context Isolation**: Each execution runs in isolated VM context
- **API Restrictions**: Limited access to Node.js APIs
- **Resource Limits**: Timeout and memory limits for code execution
- **Code Validation**: Basic validation before execution

### Safe APIs
```javascript
// Allowed APIs
const allowedGlobals = {
  console: customConsole,
  setTimeout: limitedSetTimeout,
  setInterval: limitedSetInterval,
  Promise: Promise,
  JSON: JSON,
  Math: Math,
  Date: Date
};

// Blocked APIs
const blockedApis = [
  'require',
  'process',
  'fs',
  'child_process',
  '__dirname',
  '__filename'
];
```

### Performance Considerations

### Incremental Evaluation
- Parse and cache AST to avoid re-parsing unchanged code
- Track expression dependencies to minimize re-execution
- Debounce evaluation during rapid typing
- Limit evaluation to visible editor regions

### Memory Management
- Per-document VM contexts with cleanup on file close
- Result cache with size limits and LRU eviction
- Decoration cleanup when switching files
- Garbage collection for unused contexts

### Execution Optimization
```javascript
// Smart evaluation strategy
class IncrementalEvaluator {
  evaluateChanges(document: TextDocument, changes: TextDocumentChangeEvent[]) {
    const affectedExpressions = this.findAffectedExpressions(changes);
    const dependentExpressions = this.findDependencies(affectedExpressions);
    
    // Only re-evaluate what's actually changed
    return this.evaluateExpressions([...affectedExpressions, ...dependentExpressions]);
  }
}
```

## Extension Points

### Configuration
```json
{
  "jsEvaluator.liveEvaluation": true,
  "jsEvaluator.evaluationDelay": 500,
  "jsEvaluator.maxResultLength": 100,
  "jsEvaluator.showInlineResults": true,
  "jsEvaluator.showHoverDetails": true,
  "jsEvaluator.executionTimeout": 3000
}
```

### Custom Evaluation Modes
- File-specific evaluation contexts
- Project-wide variable sharing
- Custom library imports and polyfills
- Evaluation scope limiting (function-level, block-level)

## Error Handling Strategy

### Evaluation Errors
```javascript
try {
  // Expression evaluation
  const result = vm.runInContext(expression, context);
  return { success: true, value: result };
} catch (error) {
  return {
    success: false,
    error: {
      message: error.message,
      line: this.extractLineNumber(error, sourceMap),
      type: error.constructor.name
    }
  };
}
```

### AST Parsing Errors
- Graceful degradation for syntax errors
- Partial evaluation of valid expressions
- Clear error positioning and highlighting
- Recovery strategies for incomplete code

### Performance Error Handling
- Timeout protection for infinite loops
- Memory limit enforcement
- Evaluation cancellation for rapid changes

## Testing Strategy

### Unit Tests
- AST parsing and expression identification tests
- VM execution engine tests  
- Decoration management tests
- Performance and memory tests

### Integration Tests
- End-to-end evaluation flow testing
- Editor decoration and hover integration
- Multi-file context management
- Error handling scenarios

### Performance Tests
- Large file evaluation performance
- Memory usage with long-running contexts
- Rapid typing and debouncing behavior
- Context cleanup and garbage collection

## Future Architecture Considerations

### Scalability
- Multi-workspace evaluation contexts
- Performance optimization for large codebases
- Collaborative evaluation environments
- Cloud-based execution backends

### Extensibility  
- Plugin system for additional language support
- Custom evaluation providers
- Integration with external JavaScript runtimes
- Advanced debugging and profiling features