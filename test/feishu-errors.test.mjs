import assert from 'node:assert/strict';

import {
  CARDKIT_RETRY_MS,
  RATE_LIMIT_RETRY_MS,
  feishuErrorCode,
  feishuHttpStatus,
  isRateLimitError,
  isRetryableCardKitError,
} from '../src/feishu-errors.js';

// 1) Axios/Feishu nested array shapes are flattened to the first numeric code.
const rate = { response: { status: 400, data: [{ message: 'bad request' }, { code: 230020 }] } };
assert.equal(feishuErrorCode(rate), 230020);
assert.equal(feishuHttpStatus(rate), 400);
assert.equal(isRateLimitError(rate), true);
assert.equal(isRetryableCardKitError(rate), true, '230020 is retryable for CardKit');

assert.equal(feishuErrorCode({ response: { data: { code: '300120' } } }), 300120);
assert.equal(feishuErrorCode({ code: 'ECONNRESET' }), null);
assert.equal(feishuHttpStatus({ status: 503 }), 503);
assert.equal(feishuHttpStatus({}), 0);

// 2) Network and 5xx are transient; deterministic 4xx is not.
assert.equal(isRetryableCardKitError({ code: 'ECONNRESET' }), true);
assert.equal(isRetryableCardKitError({ response: { status: 503 } }), true);
assert.equal(isRetryableCardKitError({ response: { status: 429 } }), true);
assert.equal(isRetryableCardKitError({ response: { status: 400, data: [{ code: 10002 }] } }), false);
assert.equal(isRetryableCardKitError(new Error('Feishu CardKit is unavailable')), false);
assert.equal(isRetryableCardKitError({ response: { status: 403 } }), false);

// 3) The 230020 message fallback and retry budgets stay stable.
assert.equal(isRateLimitError(new Error('Update the single messages too frequently')), true);
assert.deepEqual(RATE_LIMIT_RETRY_MS, [1_000, 2_000]);
assert.deepEqual(CARDKIT_RETRY_MS, [200, 500, 1_000]);

console.log('feishu errors: 15 assertions passed');
