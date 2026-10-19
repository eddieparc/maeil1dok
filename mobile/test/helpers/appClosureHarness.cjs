const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const mobileRoot = path.join(__dirname, '..', '..');
const tokenModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(
  fs.readFileSync(path.join(mobileRoot, 'api/authTokens.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText)(tokenModule, tokenModule.exports);
// Closures under test live in the screen files after the App.tsx split. Each
// file is searched in order; the first file declaring the name wins.
const closureSources = [
  path.join(mobileRoot, 'screens', 'WebViewScreen.tsx'),
  path.join(mobileRoot, 'screens', 'LoginScreen.tsx'),
].map((filePath) => ({
  filePath,
  sourceFile: ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  ),
}));

function findVariableInitializer(name) {
  for (const { filePath, sourceFile } of closureSources) {
    let initializer = null;
    const visit = (node) => {
      if (
        ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name)
        && node.name.text === name
      ) {
        initializer = node.initializer;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (initializer) {
      return { text: initializer.getText(sourceFile), filePath };
    }
  }
  throw new Error(`Unable to find ${name} in screens/WebViewScreen.tsx or screens/LoginScreen.tsx`);
}

function instantiateClosure(name, dependencies) {
  const bindings = {
    ...dependencies,
    tokenStore: dependencies.tokenStore
      ?? tokenModule.exports.createTokenStore(dependencies.SecureStore, dependencies.betaMode === true),
  };
  const { text, filePath } = findVariableInitializer(name);
  const compiled = ts.transpileModule(
    `const ${name} = ${text};
module.exports = { ${name} };`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const instance = new Module(filePath, module);
  instance.filename = filePath;
  instance.paths = Module._nodeModulePaths(path.dirname(filePath));
  const names = Object.keys(bindings);
  const factory = new Function('module', 'exports', ...names, compiled);
  factory(instance, instance.exports, ...names.map((key) => bindings[key]));
  return instance.exports[name];
}

module.exports = { instantiateClosure };
