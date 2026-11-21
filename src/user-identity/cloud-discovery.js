import { FeishuApiError } from './errors.js';

const tokenPattern = /^[A-Za-z0-9_-]+$/;
const cloudDomain = /^(?:[a-z0-9-]+\.)*(?:feishu\.cn|larksuite\.com|larkoffice\.com)$/;
const stringOf = (value) => typeof value === 'string' ? value : '';
const LINK_TYPES = new Map([['docs', 'doc'], ['sheets', 'sheet'], ['base', 'bitable']]);

function cloudLink(value) {
  const url = URL.parse(value);
  if (!url || url.protocol !== 'https:' || url.port || url.username || url.password || !cloudDomain.test(url.hostname)) return null;
  const space = url.pathname.match(/^\/wiki\/space\/([A-Za-z0-9_-]+)\/?$/);
  if (space) return { id: space[1], type: 'wiki_space' };
  const match = url.pathname.match(/^\/(?:drive\/)?([a-z]+)\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) return null;
  const [, type, id] = match;
  return { id, type: LINK_TYPES.get(type) ?? type };
}

/** Resolve IDs without requesting the URL or following redirects. */
export function parseCloudTarget(value, allowedTypes, defaultType) {
  const raw = stringOf(value).trim();
  const typedToken = raw.match(/^([a-z_]+):([A-Za-z0-9_-]+)$/);
  let target = cloudLink(raw);
  if (typedToken) target = { id: typedToken[2], type: typedToken[1] };
  if (tokenPattern.test(raw)) target = { id: raw, type: defaultType };
  if (!target || !allowedTypes.includes(target.type)) {
    throw new Error(`target 必须是 ${allowedTypes.join(' 或 ')} 的飞书链接或 token`);
  }
  if (target.type === 'wiki_space' && !/^\d+$/.test(target.id)) throw new Error('target 的知识空间 ID 必须为数字');
  return target;
}

export function pageOf(items, data, next, previous) {
  const hasMore = data.has_more === true;
  const pageToken = hasMore ? stringOf(next) : '';
  if (hasMore && (!pageToken || pageToken === previous)) {
    throw new FeishuApiError('飞书分页未返回有效的下一页游标');
  }
  return { items, pageToken, hasMore };
}

export function resultRows(data, key) {
  const rows = data?.[key] ?? [];
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || !Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new FeishuApiError(`飞书返回的 ${key} 格式无效`);
  }
  return rows;
}

export async function searchCloudDocs({ request, query, limit, pageToken }) {
  const data = await request({
    path: '/open-apis/search/v2/doc_wiki/search',
    method: 'POST',
    body: {
      query,
      doc_filter: {},
      wiki_filter: {},
      page_size: limit,
      ...(pageToken ? { page_token: pageToken } : {}),
    },
  });
  const items = resultRows(data, 'res_units').map((unit) => {
    const meta = unit.result_meta;
    const url = stringOf(meta?.url);
    const link = cloudLink(url);
    const type = unit.entity_type === 'WIKI' || link?.type === 'wiki'
      ? 'wiki'
      : stringOf(meta?.doc_types).toLowerCase() || link?.type || 'unknown';
    const id = link?.type === 'wiki' ? link.id : stringOf(meta?.token) || link?.id || '';
    return {
      id,
      type,
      name: stringOf(unit.title_highlighted).replace(/<\/?(?:h|hb)>/g, '') || stringOf(unit.title),
      url,
      ...(type === 'wiki' && tokenPattern.test(id) ? { target: `wiki:${id}` } : {}),
    };
  });
  return pageOf(items, data, data.page_token, pageToken);
}

export async function listCloudFolder({ request, target, limit, pageToken }) {
  const query = {
    folder_token: target,
    page_size: limit,
    page_token: pageToken,
  };
  let data;
  try {
    data = await request({ path: '/open-apis/drive/v1/files', query });
  } catch (error) {
    if (error?.feishuCode !== 99991679) throw error;
    throw new FeishuApiError('浏览云空间目录需要 space:document:retrieve 或等效 Drive 权限。请在飞书应用开通后，到「状态 → 分身状态 → 重新授权」扫码（code 99991679）', error.details);
  }
  const items = resultRows(data, 'files').map((file) => ({
    id: stringOf(file.token),
    type: stringOf(file.type) || 'unknown',
    name: stringOf(file.name),
    url: stringOf(file.url),
  }));
  return pageOf(items, data, data.next_page_token, pageToken);
}

function formatEpochSeconds(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return new Date(num > 1e12 ? num : num * 1000).toISOString();
}

/** 查询云空间资源元数据（Drive batch_query，仅需 drive:drive.metadata:readonly）。 */
export async function inspectCloudMeta({ request, id, type }) {
  let data;
  try {
    data = await request({
      path: '/open-apis/drive/v1/metas/batch_query',
      method: 'POST',
      body: {
        request_docs: [{ doc_token: id, doc_type: type }],
        with_url: true,
      },
    });
  } catch (error) {
    if (![99991672, 99991679].includes(error?.feishuCode)) throw error;
    throw new FeishuApiError(
      `查看云空间资源详情需要 drive:drive.metadata:readonly 权限。请在飞书应用开通后，到「状态 → 分身状态 → 重新授权」扫码（code ${error.feishuCode}）`,
      error.details,
    );
  }
  const metas = Array.isArray(data?.metas) ? data.metas : [];
  const meta = metas.find((item) => item?.doc_token === id) ?? metas[0];
  if (!meta) {
    throw new FeishuApiError('飞书未返回该资源的元数据，请核对链接与访问权限');
  }
  const resolvedType = stringOf(meta.doc_type) || type;
  const createTime = formatEpochSeconds(meta.create_time);
  const latestModifyTime = formatEpochSeconds(meta.latest_modify_time);
  return {
    id,
    type: resolvedType,
    name: stringOf(meta.title),
    url: stringOf(meta.url),
    target: `${resolvedType}:${id}`,
    ...(stringOf(meta.parent_token) ? { parentNodeId: stringOf(meta.parent_token) } : {}),
    ...(stringOf(meta.owner_id) ? { ownerId: stringOf(meta.owner_id) } : {}),
    ...(createTime ? { createTime } : {}),
    ...(latestModifyTime ? { latestModifyTime } : {}),
  };
}
