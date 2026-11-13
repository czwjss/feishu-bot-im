/** Normalize API/event content at the boundary; callers choose how to display it. */
export function parseJsonContent(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function messageContentOf(message) {
  return parseJsonContent(message?.content ?? message?.bodyContent ?? message?.body?.content);
}

export function messageTypeOf(message) {
  return String(message?.message_type ?? message?.msg_type ?? message?.msgType ?? '');
}

/** Locale wrappers, paragraph boundaries and attachments share one decoder. */
export function decodePost(content) {
  const localized = content?.zh_cn ?? content?.en_us ?? content?.ja_jp ?? content;
  const paragraphs = (Array.isArray(localized?.content) ? localized.content : [])
    .filter(Array.isArray).map((row) => row.filter((node) => node && typeof node === 'object'));
  const images = paragraphs.flat().filter((node) => node.tag === 'img');
  return {
    title: typeof localized?.title === 'string' ? localized.title : '',
    paragraphs,
    imageCount: images.length,
    imageKeys: [...new Set(images.map((node) => node.image_key).filter((key) => typeof key === 'string' && key))],
  };
}

export function renderPostText(post, { includeTitle = true, separator = '\n', mediaPlaceholders = false } = {}) {
  const lines = post.paragraphs.map((row) => row.map((node) => {
    if (mediaPlaceholders && node.tag === 'media') return '[视频]';
    if (mediaPlaceholders && node.tag === 'emotion') return '[表情]';
    if (typeof node.text === 'string') return node.text;
    if (node.tag === 'a' && typeof node.href === 'string') return node.href;
    return '';
  }).join(''));
  return [...(includeTitle ? [post.title] : []), ...lines].filter(Boolean).join(separator).trim();
}
