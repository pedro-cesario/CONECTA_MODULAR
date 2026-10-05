const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseBoolean } = require('../src/core/utils/parseBoolean');

describe('Core Utils — Unit Tests', () => {
  describe('parseBoolean', () => {
    it('should parse truthy values correctly', () => {
      assert.strictEqual(parseBoolean('true'), true);
      assert.strictEqual(parseBoolean('TRUE'), true);
      assert.strictEqual(parseBoolean('1'), true);
      assert.strictEqual(parseBoolean(1), true);
      assert.strictEqual(parseBoolean(true), true);
    });

    it('should parse falsy values correctly', () => {
      assert.strictEqual(parseBoolean('false'), false);
      assert.strictEqual(parseBoolean('0'), false);
      assert.strictEqual(parseBoolean(0), false);
      assert.strictEqual(parseBoolean(false), false);
      assert.strictEqual(parseBoolean(null), false);
      assert.strictEqual(parseBoolean(undefined), false);
    });

    it('should respect default fallback when value is undefined', () => {
      assert.strictEqual(parseBoolean(undefined, true), true);
      assert.strictEqual(parseBoolean(undefined, false), false);
    });
  });
});
