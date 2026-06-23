import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import compilerSfc from '../node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js';

const source = await readFile(
  new URL('../app/components/BibleScheduleContent.vue', import.meta.url),
  'utf8',
);

const { compileScript, parse: parseSfc } = compilerSfc;
const descriptor = parseSfc(source, { filename: 'BibleScheduleContent.vue' }).descriptor;
const script = compileScript(descriptor, { id: 'bible-schedule-content-test' });
const templateAst = descriptor.template?.ast;

const walkTemplate = (node, visitor) => {
  visitor(node);
  for (const child of node.children ?? []) {
    walkTemplate(child, visitor);
  }
};

const hasStaticClass = (node, className) =>
  node.props.some(prop =>
    prop.type === 6 &&
    prop.name === 'class' &&
    prop.value?.content.split(/\s+/).includes(className)
  );

const getDirectiveExpression = (node, name) => {
  const directive = node.props.find(prop => prop.type === 7 && prop.name === name);
  return directive?.exp?.content ?? '';
};

const collectRootIdentifiers = (expression) => {
  const rootIdentifiers = new Set();
  const identifierPattern = /(?<![.\w$])([A-Za-z_$][\w$]*)/g;
  const jsKeywords = new Set(['false', 'null', 'true', 'undefined']);

  for (const match of expression.matchAll(identifierPattern)) {
    const identifier = match[1];
    if (!jsKeywords.has(identifier)) {
      rootIdentifiers.add(identifier);
    }
  }

  return [...rootIdentifiers];
};

test('default plan message condition only references declared setup bindings', () => {
  const defaultPlanIndicators = [];

  walkTemplate(templateAst, (node) => {
    if (node.type === 1 && hasStaticClass(node, 'default-plan-indicator')) {
      defaultPlanIndicators.push(node);
    }
  });

  assert.equal(defaultPlanIndicators.length, 1);

  const condition = getDirectiveExpression(defaultPlanIndicators[0], 'if');
  assert.notEqual(condition, '');

  const unknownIdentifiers = collectRootIdentifiers(condition).filter(
    identifier => !script.bindings[identifier],
  );

  assert.deepEqual(unknownIdentifiers, []);
});
