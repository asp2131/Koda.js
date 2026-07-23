const assert = require('node:assert/strict');
const { LiveRunner } = require('../out/evaluator/liveRunner');

(async () => {
  const source = `function outer(value) {
  function inner(n) {
    const doubled = n * 2;
    return doubled;
  }
  return inner(value);
}
outer(21);`;
  const { records, timedOut } = await new LiveRunner().run(source);
  const innerStep = records.find(record => record.kind === 'step' && record.line === 3);

  assert.equal(timedOut, false);
  assert.ok(innerStep, 'records each executed statement');
  assert.deepEqual(innerStep.stack.map(frame => frame.name), ['inner', 'outer', 'Object.<anonymous>']);
  assert.ok(records.some(record => record.kind === 'value' && record.short === '42'));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
