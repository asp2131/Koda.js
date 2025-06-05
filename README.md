# VS Code JavaScript Console Extension

A VS Code extension that provides inline JavaScript execution and evaluation, similar to Quokka.js, for environments where browser developer tools are restricted or unavailable.

## Overview

This extension enables real-time JavaScript evaluation directly in your code editor, showing results inline as you type. Perfect for students and developers who need to test JavaScript code without access to browser developer tools or Node.js environments.

## Features

- **Inline Evaluation**: See JavaScript results directly next to your code
- **Live Execution**: Run code as you type with configurable delay
- **Value Inspector**: Hover over variables to see their current values
- **Error Highlighting**: Syntax and runtime errors highlighted inline
- **Expression Evaluation**: Evaluate selected expressions instantly
- **No External Dependencies**: Works entirely within VS Code environment

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "JavaScript Console"
4. Click Install

### Development Installation
1. Clone this repository
2. Run `npm install`
3. Press F5 to open Extension Development Host
4. Open Command Palette (Ctrl+Shift+P)
5. Type "JavaScript Console: Open"

## Usage

### Opening Inline Evaluation
- **Command Palette**: `Ctrl+Shift+P` → "JS Evaluator: Start Live Evaluation"
- **Keybinding**: `Ctrl+Shift+K` (customizable)
- **File Types**: Automatically activates for `.js` files

### Basic Operations
```javascript
let name = "World";          // → undefined
let greeting = `Hello, ${name}!`;  // → "Hello, World!"
console.log(greeting);       // → Hello, World! (in output channel)

// Math operations show inline
let result = 5 * 8;          // → 40
Math.sqrt(16);               // → 4

// Array operations
let numbers = [1, 2, 3];     // → [1, 2, 3]
numbers.map(x => x * 2);     // → [2, 4, 6]
```

### Evaluation Modes
- **Live Mode**: Results appear as you type (with debounce)
- **Manual Mode**: Evaluate with `Ctrl+Shift+E`
- **Selection Mode**: Evaluate only selected expressions

### Commands
- `JS Evaluator: Start Live Evaluation` - Enable inline evaluation
- `JS Evaluator: Stop Live Evaluation` - Disable inline evaluation  
- `JS Evaluator: Evaluate Selection` - Run selected code
- `JS Evaluator: Clear All Results` - Remove all inline results
- `JS Evaluator: Toggle Output Channel` - Show/hide console output

## Development

### Prerequisites
- Node.js 16+
- VS Code 1.74+
- TypeScript 4.9+

### Setup
```bash
git clone <repository-url>
cd vscode-js-console
npm install
```

### Available Scripts
```bash
npm run compile       # Compile TypeScript
npm run watch        # Watch for changes
npm run test         # Run tests
npm run package      # Package extension
npm run publish      # Publish to marketplace
```

### Project Structure
```
├── src/
│   ├── extension.ts         # Main extension entry point
│   ├── evaluator/           # Code evaluation engine
│   ├── decorations/         # Inline result decorations
│   ├── parser/              # AST parsing and analysis
│   └── utils/               # Utility functions
├── media/               # Icons and assets
├── test/               # Test files
└── package.json        # Extension manifest
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/username/vscode-js-console/issues)
- **Discussions**: [GitHub Discussions](https://github.com/username/vscode-js-console/discussions)
- **Documentation**: [Wiki](https://github.com/username/vscode-js-console/wiki)

## Roadmap

- [ ] Inline JavaScript evaluation
- [ ] Live result display as you type
- [ ] Expression evaluation on selection
- [ ] Error highlighting and tooltips
- [ ] Variable value inspection
- [ ] Performance optimization for large files
- [ ] Custom evaluation contexts
- [ ] Workspace-specific settings
- [ ] TypeScript support
- [ ] Integration with existing debugging tools