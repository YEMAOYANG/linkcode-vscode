import * as assert from 'assert'

// Placeholder test suite — requires @vscode/test-electron to run in VS Code context
suite('LinkCode Extension', () => {
  test('Extension module exports activate and deactivate', () => {
    const ext = require('../src/extension')
    assert.strictEqual(typeof ext.activate, 'function')
    assert.strictEqual(typeof ext.deactivate, 'function')
  })
})
