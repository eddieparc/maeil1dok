const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const mobileRoot = path.join(__dirname, '..', '..');
const appPath = path.join(mobileRoot, 'App.tsx');
const appSource = fs.readFileSync(appPath, 'utf8');
const sourceFile = ts.createSourceFile(
  appPath,
  appSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function findVariableInitializer(name) {
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
  if (!initializer) throw new Error(`Unable to find ${name} in App.tsx`);
  return initializer.getText(sourceFile);
}

function instantiateClosure(name, dependencies) {
  const compiled = ts.transpileModule(
    `const ${name} = ${findVariableInitializer(name)};
module.exports = { ${name} };`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const instance = new Module(appPath, module);
  instance.filename = appPath;
  instance.paths = Module._nodeModulePaths(path.dirname(appPath));
  const names = Object.keys(dependencies);
  const factory = new Function('module', 'exports', ...names, compiled);
  factory(instance, instance.exports, ...names.map((key) => dependencies[key]));
  return instance.exports[name];
}

module.exports = { instantiateClosure };
