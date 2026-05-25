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
exports.instrument = void 0;
const acorn = __importStar(require("acorn"));
/** Is this expression a `console.*(...)` call? Those are captured via the console override, not wrapped. */
function isConsoleCall(node) {
    return (node &&
        node.type === 'CallExpression' &&
        node.callee &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'console');
}
/**
 * Parse `code` and return an instrumented version. Throws acorn's SyntaxError
 * on invalid input (callers should surface that as a diagnostic).
 */
function instrument(code) {
    const ast = acorn.parse(code, {
        ecmaVersion: 'latest',
        locations: true,
        ranges: true,
        sourceType: 'module',
        allowReturnOutsideFunction: true,
    });
    const edits = [];
    const mark = (pos, text, order) => edits.push({ pos, text, order });
    /** Wrap an expression node so its runtime value is captured (and returned unchanged). */
    const wrap = (expr, line) => {
        if (!expr || !expr.range) {
            return;
        }
        mark(expr.range[0], `globalThis.__kodaCapture(${line},(`, /*order*/ 5);
        mark(expr.range[1], `))`, /*order*/ 5);
    };
    /**
     * Instrument every statement in a statement LIST (Program.body,
     * BlockStatement.body, SwitchCase.consequent). Only list elements are safe to
     * prefix with a marker — injecting before a brace-less `if`/`for`/`else` body
     * would re-bind it and break control flow, so those are reached only via
     * `descend` into their explicit `{...}` blocks.
     */
    const processBody = (statements) => statements.forEach(instrumentStatement);
    const instrumentStatement = (node) => {
        if (!node || !node.loc || !node.range) {
            return;
        }
        const line = node.loc.start.line;
        // Line marker before the statement (order 0 = before any wrapper at same pos).
        mark(node.range[0], `globalThis.__kodaLine=${line};`, 0);
        switch (node.type) {
            case 'ExpressionStatement':
                if (!isConsoleCall(node.expression)) {
                    wrap(node.expression, line);
                }
                break;
            case 'VariableDeclaration':
                for (const decl of node.declarations) {
                    if (decl.init && !isConsoleCall(decl.init)) {
                        wrap(decl.init, line);
                    }
                }
                break;
            case 'ReturnStatement':
                if (node.argument && !isConsoleCall(node.argument)) {
                    wrap(node.argument, line);
                }
                break;
            default:
                break;
        }
        descend(node);
    };
    /**
     * Recurse into the explicit `{...}` blocks reachable from `node` so values
     * inside functions, loops, and branches are captured where they execute.
     * Brace-less bodies (e.g. `if (x) foo();`) are intentionally NOT instrumented
     * in v1 — instrumenting them safely requires synthesizing braces.
     */
    const descend = (node) => {
        if (!node || typeof node !== 'object') {
            return;
        }
        const intoBlock = (b) => { if (b && b.type === 'BlockStatement') {
            processBody(b.body);
        } };
        switch (node.type) {
            case 'BlockStatement':
                processBody(node.body);
                break;
            case 'FunctionDeclaration':
            case 'FunctionExpression':
            case 'ArrowFunctionExpression':
                intoBlock(node.body); // arrow expression-body has no block; skipped
                break;
            case 'IfStatement':
                intoBlock(node.consequent);
                intoBlock(node.alternate); // `else if` is an IfStatement, not a block — also skipped in v1
                break;
            case 'ForStatement':
            case 'ForInStatement':
            case 'ForOfStatement':
            case 'WhileStatement':
            case 'DoWhileStatement':
                intoBlock(node.body);
                break;
            case 'LabeledStatement':
                descend(node.body);
                break;
            case 'TryStatement':
                intoBlock(node.block);
                if (node.handler) {
                    intoBlock(node.handler.body);
                }
                intoBlock(node.finalizer);
                break;
            case 'SwitchStatement':
                node.cases.forEach((c) => processBody(c.consequent));
                break;
            case 'VariableDeclaration':
                // Function expressions assigned to a variable still have instrumentable bodies.
                node.declarations.forEach((d) => d.init && descend(d.init));
                break;
            default:
                break;
        }
    };
    processBody(ast.body);
    return applyEdits(code, edits);
}
exports.instrument = instrument;
/** Apply insertion edits left-to-right (stable on shared positions via `order`). */
function applyEdits(code, edits) {
    edits.sort((a, b) => a.pos - b.pos || a.order - b.order);
    let out = '';
    let last = 0;
    for (const e of edits) {
        out += code.slice(last, e.pos) + e.text;
        last = e.pos;
    }
    return out + code.slice(last);
}
//# sourceMappingURL=instrumenter.js.map