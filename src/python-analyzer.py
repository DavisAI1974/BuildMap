"""BuildMap's trusted, isolated syntax reader. Never imports the mapped project."""
import ast
import json
import sys


def location(node):
    return {"line": node.lineno, "column": node.col_offset + 1}


def expr(node):
    if node is None:
        return "no explicit value"
    value = ast.unparse(node)
    return value if len(value) <= 240 else value[:237] + "..."


def name(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = name(node.value)
        return base + "." + node.attr if base else ""
    return ""


def literal(node):
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def range_count(node):
    # Written literal range bounds only. Never evaluate an expression or a target call.
    if not isinstance(node, ast.Call) or name(node.func) != "range" or node.keywords:
        return None
    def integer(n):
        if isinstance(n, ast.Constant) and type(n.value) is int:
            return n.value
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub) and isinstance(n.operand, ast.Constant) and type(n.operand.value) is int:
            return -n.operand.value
        return None
    values = [integer(n) for n in node.args]
    if not 1 <= len(values) <= 3 or any(v is None for v in values):
        return None
    start, stop, step = (0, values[0], 1) if len(values) == 1 else (values[0], values[1], values[2] if len(values) == 3 else 1)
    if step == 0:
        return None
    count = max(0, (stop - start + step - (1 if step > 0 else -1)) // step)
    return str(count)


def analyze(source):
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError, RecursionError) as error:
        return {"status": "parse-error", "reason": "Python source could not be parsed: " + type(error).__name__, "functions": []}
    definitions = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            definitions.append((node.name, node, 'function'))
        elif isinstance(node, ast.ClassDef):
            definitions.extend((node.name + '.' + method.name, method, 'method') for method in node.body
                               if isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)))
    imports = {}
    for n in tree.body:
        if isinstance(n, ast.Import):
            for a in n.names:
                imports[a.asname or a.name.split('.')[0]] = a.name
        if isinstance(n, ast.ImportFrom) and n.module and not n.level:
            for a in n.names:
                imports[a.asname or a.name] = n.module + "." + a.name
    # Conservatively suppress library recognition for any binding/reassignment,
    # including one in another scope. This avoids claiming a shadowed call is I/O.
    bound = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del))}
    bound.update(n.arg for n in ast.walk(tree) if isinstance(n, ast.arg))
    bound.update(n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)))
    imports = {k: v for k, v in imports.items() if k not in bound}

    def canonical(target):
        root, *rest = target.split('.')
        return '.'.join([imports.get(root, root), *rest])

    class Reader(ast.NodeVisitor):
        def __init__(self):
            self.calls, self.returns, self.io, self.loop_paths, self.cues, self.stack, self.transformations = [], [], [], [], [], [], []
            self.conditions = self.loops = self.throws = 0
            self.yields = 0
            self.comprehensions = []

        def visit_FunctionDef(self, node):
            pass  # Nested bodies/defaults/decorators belong to a different scope.
        visit_AsyncFunctionDef = visit_FunctionDef
        visit_ClassDef = visit_FunctionDef
        visit_Lambda = visit_FunctionDef
        def visit_ListComp(self, node):
            axes = []
            for generator in node.generators:
                axes.append({"target": expr(generator.target), "iterable": expr(generator.iter),
                             "filters": [expr(test) for test in generator.ifs], "async": bool(generator.is_async),
                             "literalRangeCount": range_count(generator.iter) if 'range' not in bound and 'range' not in imports else None,
                             **location(generator.target)})
            self.comprehensions.append({"kind": type(node).__name__, "evaluation": 'deferred-expression' if isinstance(node, ast.GeneratorExp) else 'eager-container',
                                        "axes": axes, **location(node)})
            # A generator's first iterable is evaluated at construction. Its
            # body/filters/inner iterables may never be consumed: do not turn
            # their call sites into observed or repeated file-read findings.
            if isinstance(node, ast.GeneratorExp):
                self.visit(node.generators[0].iter)
            else:
                for generator in node.generators:
                    self.visit(generator.iter)
                    self.stack.append({"target": expr(generator.target), "iterable": expr(generator.iter), **location(generator.target)})
                    for condition in generator.ifs:
                        self.visit(condition)
                if isinstance(node, ast.DictComp):
                    self.visit(node.key)
                    self.visit(node.value)
                else:
                    self.visit(node.elt)
                del self.stack[-len(node.generators):]
        visit_SetComp = visit_ListComp
        visit_DictComp = visit_ListComp
        visit_GeneratorExp = visit_ListComp

        def visit_For(self, node):
            self.loops += 1
            axis = {"target": expr(node.target), "iterable": expr(node.iter), "literalRangeCount": range_count(node.iter) if 'range' not in bound and 'range' not in imports else None, **location(node)}
            self.visit(node.iter)  # Iterator expression runs before this loop.
            self.stack.append(axis)
            if len(self.stack) >= 2:
                self.loop_paths.append(list(self.stack))
            for statement in node.body:
                self.visit(statement)
            self.stack.pop()
            for statement in node.orelse:
                self.visit(statement)
        visit_AsyncFor = visit_For

        def visit_While(self, node):
            self.loops += 1
            self.stack.append({"target": "while condition", "iterable": expr(node.test), "literalRangeCount": None, **location(node)})
            if len(self.stack) >= 2:
                self.loop_paths.append(list(self.stack))
            self.visit(node.test)
            for statement in node.body:
                self.visit(statement)
            self.stack.pop()
            for statement in node.orelse:
                self.visit(statement)

        def visit_If(self, node):
            self.conditions += 1
            self.generic_visit(node)
        visit_IfExp = visit_If

        def visit_Raise(self, node):
            self.throws += 1
            self.generic_visit(node)

        def visit_Return(self, node):
            self.returns.append({"summary": expr(node.value), "kind": type(node.value).__name__, **location(node)})
            self.generic_visit(node)

        def visit_Yield(self, node):
            self.yields += 1
            self.generic_visit(node)
        visit_YieldFrom = visit_Yield

        def visit_Assign(self, node):
            self.transformations.append({"summary": expr(node), "kind": type(node).__name__, **location(node)})
            self.generic_visit(node)
        visit_AnnAssign = visit_Assign
        visit_AugAssign = visit_Assign

        def visit_Call(self, node):
            target = name(node.func) or "computed callable"
            resolved = canonical(target)
            self.calls.append({"target": target, "kind": "call", "argumentCount": len(node.args) + len(node.keywords),
                               "arguments": [expr(a) for a in node.args] + [(k.arg or '**') + '=' + expr(k.value) for k in node.keywords],
                               "resolution": "unresolved-source-reference", **location(node)})
            if any(word in resolved.lower() for word in ('cache', 'couplingjobs', 'celljobsubset', 'checkpoint', 'receipt', 'indexed', 'fft', 'reuse')):
                self.cues.append({"expression": expr(node), "basis": "name-only; behavior unverified", **location(node)})
            product = operation = None
            root = target.split('.')[0]
            if resolved in ('pandas.read_csv', 'pandas.read_parquet', 'pandas.read_pickle', 'numpy.load') and root in imports:
                product = literal(node.args[0]) if node.args else next((literal(k.value) for k in node.keywords if k.arg in ('filepath_or_buffer', 'path', 'file')), None)
                operation = 'read'
            elif target == 'open' and 'open' not in bound and 'open' not in imports:
                product = literal(node.args[0]) if node.args else next((literal(k.value) for k in node.keywords if k.arg == 'file'), None)
                mode_node = node.args[1] if len(node.args) > 1 else next((k.value for k in node.keywords if k.arg == 'mode'), ast.Constant(value='r'))
                mode = literal(mode_node)
                if mode is not None:
                    operation = 'read-write' if '+' in mode else 'write' if any(c in mode for c in 'wax') else 'read'
            elif isinstance(node.func, ast.Attribute) and node.func.attr in ('to_csv', 'to_parquet', 'to_pickle'):
                product = literal(node.args[0]) if node.args else next((literal(k.value) for k in node.keywords if k.arg in ('path', 'path_or_buf')), None)
                operation = 'write'
            elif resolved == 'numpy.save' and root in imports:
                product = literal(node.args[0]) if node.args else None
                operation = 'write'
            if product is not None and operation:
                self.io.append({"pathExpression": product, "operation": operation, "call": target,
                                "basis": "literal-path-call-syntax", "loopDepth": len(self.stack), **location(node)})
            self.generic_visit(node)

    records = []
    scopes = [(qualified, n.body, n, kind) for qualified, n, kind in definitions]
    module_body = [n for n in tree.body if not isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
    if module_body:
        scopes.insert(0, ('<module>', module_body, None, 'module'))
    for function_name, body, fn, scope_kind in scopes:
        reader = Reader()
        for statement in body:
            reader.visit(statement)
        args = fn.args if fn else None
        parameters = ([a.arg for a in args.posonlyargs + args.args] + (["*" + args.vararg.arg] if args.vararg else []) + [a.arg for a in args.kwonlyargs] + (["**" + args.kwarg.arg] if args.kwarg else [])) if args else []
        decorators = [{"expression": expr(d), "basis": "decorator syntax; effect unverified", **location(d)} for d in fn.decorator_list] if fn else []
        records.append({"name": function_name, "language": "Python", "scopeKind": scope_kind, "exported": False, "async": isinstance(fn, ast.AsyncFunctionDef), "generator": reader.yields > 0,
                        "parameters": parameters, "calls": reader.calls, "returns": reader.returns,
                        "conditions": reader.conditions, "loops": reader.loops, "throws": reader.throws,
                        "line": fn.lineno if fn else 1, "column": fn.col_offset + 1 if fn else 1, "endLine": fn.end_lineno if fn else len(source.splitlines()),
                        "summary": f"{function_name} declares {len(parameters)} parameters, {len(reader.calls)} call sites and {reader.loops} loop constructs. Paths and branches may never run.",
                        "io": reader.io, "loopPaths": reader.loop_paths, "reuseCues": reader.cues, "decorators": decorators,
                        "transformations": reader.transformations, "comprehensions": reader.comprehensions})
    return {"status": "parsed", "reason": "Parsed Python source syntax using isolated standard-library AST; target code was not executed.", "functions": records}


if __name__ == '__main__':
    inputs = json.load(sys.stdin)
    outputs = []
    for item in inputs:
        try:
            outputs.append(analyze(item['source']))
        except (RecursionError, MemoryError, ValueError) as error:
            outputs.append({"status": "analysis-limit", "reason": "Python syntax analysis limit: " + type(error).__name__, "functions": []})
    json.dump(outputs, sys.stdout)
