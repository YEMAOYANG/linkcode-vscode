import * as assert from 'assert'
import { CompletionCache } from '../../completion/cache'

suite('CompletionCache', () => {
  let cache: CompletionCache

  setup(() => {
    cache = new CompletionCache(3, 1000)
  })

  test('should return undefined for cache miss', () => {
    assert.strictEqual(cache.get('nonexistent'), undefined)
  })

  test('should return cached value on hit', () => {
    cache.set('key1', 'value1')
    assert.strictEqual(cache.get('key1'), 'value1')
  })

  test('should evict least-recently-used when at capacity', () => {
    cache.set('a', 'value-a')
    cache.set('b', 'value-b')
    cache.set('c', 'value-c')
    // Cache is now full (maxSize=3)
    cache.set('d', 'value-d')
    // 'a' should be evicted (LRU)
    assert.strictEqual(cache.get('a'), undefined)
    assert.strictEqual(cache.get('d'), 'value-d')
  })

  test('should promote entry on access', () => {
    cache.set('a', 'value-a')
    cache.set('b', 'value-b')
    cache.set('c', 'value-c')
    // Access 'a' to promote it
    cache.get('a')
    // Insert 'd' — 'b' should be evicted, not 'a'
    cache.set('d', 'value-d')
    assert.strictEqual(cache.get('b'), undefined)
    assert.strictEqual(cache.get('a'), 'value-a')
  })

  test('should expire entries after TTL', async () => {
    const shortCache = new CompletionCache(10, 50) // 50ms TTL
    shortCache.set('key', 'value')
    assert.strictEqual(shortCache.get('key'), 'value')

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 60))
    assert.strictEqual(shortCache.get('key'), undefined)
  })

  test('should build correct cache key', () => {
    const key = CompletionCache.buildKey('file:///a.ts', 'const x = ')
    assert.strictEqual(key, 'file:///a.ts:const x = ')
  })

  test('should clear all entries', () => {
    cache.set('a', 'value-a')
    cache.set('b', 'value-b')
    assert.strictEqual(cache.size, 2)
    cache.clear()
    assert.strictEqual(cache.size, 0)
    assert.strictEqual(cache.get('a'), undefined)
  })

  test('should update existing key without increasing size', () => {
    cache.set('key', 'old-value')
    cache.set('key', 'new-value')
    assert.strictEqual(cache.size, 1)
    assert.strictEqual(cache.get('key'), 'new-value')
  })
})

suite('debounce utility', () => {
  test('should delay execution', async () => {
    const { debounce } = await import('../../utils/debounce')
    let callCount = 0
    const fn = debounce(() => { callCount++ }, 50)

    fn()
    fn()
    fn()

    assert.strictEqual(callCount, 0, 'should not be called immediately')

    await new Promise((resolve) => setTimeout(resolve, 80))
    assert.strictEqual(callCount, 1, 'should be called once after delay')
  })

  test('should reset timer on subsequent calls', async () => {
    const { debounce } = await import('../../utils/debounce')
    let callCount = 0
    const fn = debounce(() => { callCount++ }, 50)

    fn()
    await new Promise((resolve) => setTimeout(resolve, 30))
    fn() // Reset timer
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.strictEqual(callCount, 0, 'should not fire during reset window')

    await new Promise((resolve) => setTimeout(resolve, 40))
    assert.strictEqual(callCount, 1, 'should fire once after final delay')
  })
})

suite('shared/errors', () => {
  test('LinkCodeError should have correct code', async () => {
    const { LinkCodeError } = await import('../../shared/errors')
    const err = new LinkCodeError('test', 'TEST_CODE')
    assert.strictEqual(err.code, 'TEST_CODE')
    assert.strictEqual(err.message, 'test')
    assert.strictEqual(err.name, 'LinkCodeError')
  })

  test('ApiError should have status', async () => {
    const { ApiError } = await import('../../shared/errors')
    const err = new ApiError('not found', 404)
    assert.strictEqual(err.status, 404)
    assert.strictEqual(err.code, 'API_ERROR')
    assert.strictEqual(err.name, 'ApiError')
  })

  test('AuthError should have AUTH_ERROR code', async () => {
    const { AuthError } = await import('../../shared/errors')
    const err = new AuthError('no key')
    assert.strictEqual(err.code, 'AUTH_ERROR')
    assert.strictEqual(err.name, 'AuthError')
  })
})

suite('shared/constants', () => {
  test('should export expected constants', async () => {
    const constants = await import('../../shared/constants')
    assert.strictEqual(typeof constants.DEBOUNCE_MS, 'number')
    assert.strictEqual(typeof constants.CACHE_TTL_MS, 'number')
    assert.strictEqual(typeof constants.MAX_CACHE_SIZE, 'number')
    assert.strictEqual(typeof constants.API_TIMEOUT_MS, 'number')
    assert.strictEqual(typeof constants.CONFIG_SECTION, 'string')
    assert.strictEqual(constants.CONFIG_SECTION, 'linkcode')
  })
})

suite('utils/crypto', () => {
  test('getNonce should return 32-char base64url string', async () => {
    const { getNonce } = await import('../../utils/crypto')
    const nonce = getNonce()
    assert.strictEqual(nonce.length, 32)
    assert.match(nonce, /^[A-Za-z0-9_-]+$/)
  })

  test('getNonce should return different values each call', async () => {
    const { getNonce } = await import('../../utils/crypto')
    const a = getNonce()
    const b = getNonce()
    assert.notStrictEqual(a, b)
  })
})
