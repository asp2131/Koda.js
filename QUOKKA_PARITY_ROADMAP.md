# Koda.js Quokka Feature Parity Roadmap

This document outlines how to mimic Quokka.js's output formatting and identifies essential features that Koda.js is currently missing.

## Current Status

Koda.js has basic inline evaluation working with:
- ✅ Live evaluation on file changes
- ✅ Inline result display using VS Code decorations
- ✅ Error display
- ✅ Console.log capture
- ✅ Time travel debugging (basic)
- ✅ Object formatting with `util.inspect()` (recently added)

## Quokka Output Formatting to Implement

### 1. Smart Value Truncation
**Current Issue:** Long values can overflow the inline display.

**Quokka's Approach:**
- Truncate strings to ~50-100 characters with `...` indicator
- Limit array display to first 10 elements
- Limit object depth to 2-3 levels
- Show full value in hover tooltip

**Implementation:**
```typescript
// In resultDecorator.ts
const truncateValue = (value: string, maxLength: number = 50): string => {
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + '...';
};

// In hover provider
const getFullValue = (result: any): string => {
  return util.inspect(result, { depth: null, maxArrayLength: null });
};
```

### 2. Color-Coded Output Types
**Current Issue:** All results use the same blue color.

**Quokka's Approach:**
- Strings: Green
- Numbers: Blue  
- Booleans: Purple
- Objects/Arrays: Gray
- Errors: Red
- undefined/null: Gray italic

**Implementation:**
Create multiple decoration types in `resultDecorator.ts`:
```typescript
private stringDecorationType: vscode.TextEditorDecorationType;
private numberDecorationType: vscode.TextEditorDecorationType;
private booleanDecorationType: vscode.TextEditorDecorationType;
private objectDecorationType: vscode.TextEditorDecorationType;
private undefinedDecorationType: vscode.TextEditorDecorationType;
```

### 3. Identifier Expression Logging
**Current Issue:** Koda only evaluates selected expressions or full file.

**Quokka's Approach:**
- Typing just a variable name shows its value inline
- No need to select or wrap in console.log
- Works for any identifier in scope

**Implementation:**
Modify parser to identify standalone identifier expressions and auto-evaluate them.

### 4. Live Comments (/*?*/ and //?)
**Current Issue:** No support for special comment syntax.

**Quokka's Approach:**
- `/*?*/` after expression: Shows value inline
- `//?` after statement: Shows value inline
- `/*?.*/`: Shows execution time
- Comments can contain code using `$` variable

**Example:**
```javascript
a.b().c() /*?*/.d();  // Shows result of a.b().c()
const x = compute(); //?  // Shows value of x
heavyOperation(); /*?.*/  // Shows execution time
```

**Implementation:**
1. Parse comments in the AST
2. Detect special comment patterns
3. Evaluate the expression before the comment
4. Display result inline

### 5. Logpoints (Breakpoints as Loggers)
**Current Issue:** No breakpoint integration.

**Quokka's Approach:**
- Use F9 to toggle logpoints
- Shows value without modifying code
- Can be inline (mid-line) or line-level
- Persist across sessions

**Implementation:**
Use VS Code's breakpoint API:
```typescript
vscode.debug.onDidChangeBreakpoints(e => {
  // Check for custom breakpoint type
  // Evaluate expression at breakpoint location
  // Display value inline
});
```

### 6. Value Explorer Panel
**Current Issue:** No dedicated panel for exploring values.

**Quokka's Approach:**
- Tree view panel showing all logged values
- Expandable object explorer
- Real-time updates
- Copy to clipboard functionality
- Search/filter capabilities

**Implementation:**
Create a TreeView provider:
```typescript
class ValueExplorerProvider implements vscode.TreeDataProvider<ValueNode> {
  // Show all console.log outputs and expression results
  // Allow expanding objects
  // Sync with editor decorations
}
```

### 7. Code Coverage Indicators
**Current Issue:** No coverage visualization.

**Quokka's Approach:**
- Gray gutter: Line not executed
- Yellow gutter: Partially executed (branches)
- Green gutter: Fully executed
- Red gutter: Error on line

**Implementation:**
Track which lines execute during evaluation:
```typescript
// Instrument code to report line execution
// Use setDecorations with gutter icon ranges
const coverageDecorationType = vscode.window.createTextEditorDecorationType({
  gutterIconPath: context.asAbsolutePath('icons/green-dot.svg'),
  gutterIconSize: 'contain'
});
```

### 8. Hover Tooltips
**Current Issue:** No hover information.

**Quokka's Approach:**
- Hover over any expression to see its value
- Shows full object/array without truncation
- Includes type information

**Implementation:**
```typescript
vscode.languages.registerHoverProvider('javascript', {
  provideHover(document, position) {
    // Find expression at position
    // Get cached evaluation result
    // Return hover with formatted value
  }
});
```

## Essential Missing Features

### High Priority

1. **Project File Imports**
   - Allow importing local project files
   - Watch for changes and re-evaluate
   - Support for npm packages

2. **TypeScript Support**
   - Transpile TS before evaluation
   - Show type info in hovers
   - Support for TS-specific syntax

3. **Better Error Display**
   - Stack traces with line numbers
   - Error highlighting in editor
   - Suggestions for common mistakes

4. **Performance Optimization**
   - Smarter re-evaluation (only changed parts)
   - Worker thread for evaluation
   - Caching of results

### Medium Priority

5. **Value Peek (Hover to evaluate)**
   - Evaluate expressions on hover
   - No need to modify code
   - Configurable delay

6. **Auto Log All Values**
   - Toggle to show every line's value
   - Useful for debugging sessions

7. **Copy Value Command**
   - Copy any expression value to clipboard
   - Keyboard shortcut (Cmd+K, X)

8. **Multiple Output Formats**
   - JSON view
   - Table view for arrays
   - Tree view for objects

### Lower Priority

9. **Interactive Value Graphs**
   - Visual representation of data structures
   - Good for complex nested objects

10. **CPU Profiler**
    - Show execution time per line
    - Identify bottlenecks

11. **Code Story Viewer**
    - Step-by-step execution view
    - Shows how values change

12. **Snaps (Code Snippets)**
    - Save and share code snippets
    - Embeddable in documentation

## Implementation Priority

### Phase 1: Core Experience (Week 1-2)
1. Smart value truncation with hover tooltips
2. Color-coded output types
3. Identifier expression logging
4. Basic hover provider

### Phase 2: Developer Experience (Week 3-4)
5. Live comments (/*?*/ and //?)
6. Value Explorer panel
7. Copy value command
8. Better error display with stack traces

### Phase 3: Advanced Features (Week 5-6)
9. Logpoints integration
10. Code coverage indicators
11. Project file imports
12. TypeScript support

### Phase 4: Polish (Week 7-8)
13. Performance optimization
14. Auto log all values
15. Value peek on hover
16. Multiple output formats

## Technical Notes

### Architecture Changes Needed

1. **Evaluation Engine**
   - Currently uses `vm.runInContext`
   - Need to instrument code for coverage
   - Consider using worker threads for isolation

2. **Parser**
   - Currently uses Acorn
   - Need to detect comments for live comments feature
   - May need Babel for TypeScript support

3. **State Management**
   - Cache evaluation results
   - Track which lines have been executed
   - Store logpoint configurations

4. **UI Components**
   - TreeView for Value Explorer
   - HoverProvider for tooltips
   - Custom editor for Code Story
   - Webview panels for interactive features

### VS Code APIs to Use

- `vscode.window.createTextEditorDecorationType` - Inline values
- `vscode.languages.registerHoverProvider` - Hover tooltips
- `vscode.window.registerTreeDataProvider` - Value Explorer
- `vscode.debug.onDidChangeBreakpoints` - Logpoints
- `vscode.workspace.onDidChangeTextDocument` - Live evaluation
- `vscode.commands.registerCommand` - Custom commands
- `vscode.StatusBarItem` - Status indicators

## References

- [Quokka.js Documentation](https://quokkajs.com/docs/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Acorn Parser](https://github.com/acornjs/acorn)
- [Node.js VM Module](https://nodejs.org/api/vm.html)

---

*Last updated: January 29, 2026*
*Next review: After Phase 1 completion*
