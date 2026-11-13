import assert from 'node:assert/strict';
import { test } from 'node:test';
import { messageContentOf, messageTypeOf, decodePost } from '../src/message-content.js';
import { textOfContentOrPost } from '../src/message-text.js';
import { describeMessageForEavesdrop } from '../src/eavesdrop.js';
import { extractMessageText } from '../src/user-identity/api.js';
import { InboundContent } from '../src/inbound.js';

const content = { ja_jp: { title: '标题', content: [
  [{ tag: 'text', text: '第一行' }, { tag: 'img', image_key: 'image-1' }],
  [{ tag: 'a', href: 'https://example.com' }, { tag: 'img', image_key: 'image-2' }],
] } };

test('event and API messages share localized post decoding while keeping their presentation', () => {
  const event = { message_type: 'post', content: JSON.stringify(content) };
  const api = { msg_type: 'post', body: { content: JSON.stringify(content) } };
  const cached = { msgType: 'post', bodyContent: content };
  for (const message of [event, api, cached]) {
    assert.equal(messageTypeOf(message), 'post');
    assert.deepEqual(messageContentOf(message), content);
    assert.equal(textOfContentOrPost(message), '第一行\nhttps://example.com');
    assert.equal(extractMessageText(message), '标题\n第一行\nhttps://example.com');
    assert.equal(describeMessageForEavesdrop(message).text, '标题 第一行 https://example.com [图片 ×2]');
  }
});

test('localized rich-text attachments reach the native image input', async () => {
  const downloads = [];
  const inbound = new InboundContent({ bot: {
    async downloadResource(messageId, key, kind) {
      downloads.push({ messageId, key, kind });
      return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
    },
  } });
  const message = { message_id: 'message', message_type: 'post', content: JSON.stringify(content) };
  const result = await inbound.build(message, textOfContentOrPost(message));
  assert.equal(result.hasInput, true);
  assert.equal(result.parts.filter((part) => part.type === 'image').length, 2);
  assert.deepEqual(downloads.map((item) => item.key), ['image-1', 'image-2']);
  assert.ok(downloads.every((item) => item.messageId === 'message' && item.kind === 'image'));
});

test('malformed content and rows fail closed without breaking message handling', () => {
  assert.deepEqual(messageContentOf({ content: '{' }), {});
  assert.deepEqual(messageContentOf({ content: '[]' }), {});
  assert.equal(textOfContentOrPost({ message_type: 'post', content: '{' }), null);
  assert.deepEqual(decodePost({ content: [null, 3, [null, 'bad', { tag: 'text', text: 'ok' }]] }).paragraphs,
    [[{ tag: 'text', text: 'ok' }]]);
});
