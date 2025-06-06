# Koda.js

A powerful VS Code extension for real-time JavaScript evaluation and inline code execution. Experience immediate feedback as you write JavaScript code with live results displayed directly in your editor.

## 🚀 Features

- **Live Evaluation**: See JavaScript results instantly as you type
- **Inline Results**: Code outputs appear right next to your expressions
- **Error Highlighting**: Syntax and runtime errors highlighted with clear diagnostics
- **Smart Parsing**: Advanced AST-based parsing for accurate code analysis
- **Zero Setup**: Works out of the box with no configuration required
- **Safe Execution**: Sandboxed evaluation environment with timeout protection

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Koda.js"
4. Click Install

### Quick Start
1. Open any JavaScript file
2. Press `Ctrl+Shift+K` (or `Cmd+Shift+K` on Mac)
3. Start typing JavaScript code and see results instantly!

## 🎯 Usage

### Live Evaluation
```javascript
let name = "Koda";                    // → undefined
let greeting = `Hello, ${name}!`;     // → "Hello, Koda!"
console.log(greeting);                // → Hello, Koda!

// Math operations
let result = 42 * 1.5;               // → 63
Math.sqrt(144);                      // → 12

// Array operations  
let numbers = [1, 2, 3, 4, 5];       // → [1, 2, 3, 4, 5]
numbers.map(x => x * 2);             // → [2, 4, 6, 8, 10]
numbers.filter(x => x > 3);          // → [4, 5]

// Object operations
let user = { name: "Alice", age: 30 }; // → {name: "Alice", age: 30}
user.name.toUpperCase();               // → "ALICE"
```

### Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Koda.js: Start Live Evaluation** | `Ctrl+Shift+K` | Enable real-time code evaluation |
| **Koda.js: Stop Live Evaluation** | - | Disable live evaluation |
| **Koda.js: Evaluate Selection** | - | Evaluate only selected code |
| **Koda.js: Clear All Results** | - | Remove all inline results |

### Settings

Configure Koda.js through VS Code settings:

```json
{
  "jsEvaluator.liveEvaluation.enabled": true,
  "jsEvaluator.evaluationDelay": 500,
  "jsEvaluator.maxResultLength": 100,
  "jsEvaluator.showInlineResults": true,
  "jsEvaluator.showHoverDetails": true,
  "jsEvaluator.executionTimeout": 3000
}
```

## 🛠️ Development

### Prerequisites
- Node.js 16+
- VS Code 1.74+
- TypeScript 4.9+

### Setup
```bash
git clone https://github.com/asp2131/codeecho.git
cd codeecho
npm install
npm run compile
```

### Scripts
```bash
npm run compile     # Compile TypeScript
npm run watch      # Watch for changes
npm run package    # Package extension  
npm run publish    # Publish to marketplace
```

### Architecture
```
src/
├── extension.ts           # Main extension entry
├── evaluator/
│   ├── engine.ts         # Safe evaluation engine
│   └── parser.ts         # AST parsing & analysis
├── decorations/
│   └── resultDecorator.ts # Inline result display
└── utils/                # Utility functions
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🐛 Support

- **Issues**: [GitHub Issues](https://github.com/asp2131/codeecho/issues)
- **Repository**: [GitHub](https://github.com/asp2131/codeecho)

## 🗺️ Roadmap

- [x] Real-time JavaScript evaluation
- [x] Inline result display
- [x] Error highlighting and diagnostics
- [x] Expression parsing and evaluation
- [x] Safe execution environment
- [ ] TypeScript support
- [ ] Multi-file evaluation
- [ ] Custom evaluation contexts
- [ ] Performance optimizations
- [ ] Advanced debugging features

---

**Koda.js** - Making JavaScript development faster and more interactive! ⚡