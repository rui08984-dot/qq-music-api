import type { Context } from 'koa';
import services from '../services';
import { getTypedQuery } from '../types/core/request';
import { getAuthToken } from './login';

// src/controllers/recommend.ts
// QQ 音乐推荐面向的五个入口。全部要求扫码登录态：脱了凭据上游只会回运营向的通用内容，
// `get_radio_track` 更是直接 `code: 1000` + 空 tracks，所以这里统一按 401 收口，不做匿名兜底。

const unauthorized = (ctx: Context): void => {
  ctx.status = 401;
  ctx.body = { code: 401, message: 'Login required' };
};

/** 猜你喜欢电台，也是刷歌的数据来源。 */
export const guessRecommend = async (ctx: Context): Promise<void> => {
  const { num } = getTypedQuery<{ num?: string }>(ctx);
  const data = await services.recommend.getGuessRecommend({
    token: getAuthToken(ctx),
    num: Number(num),
  });
  if (!data) return unauthorized(ctx);
  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  ctx.status = 200;
  ctx.body = { code: 200, tracks, total: tracks.length };
};

/** 电台「不感兴趣」：把这首单曲从猜你喜欢画像里拉黑。写操作，header 只认裸 token。 */
export const radioDislike = async (ctx: Context): Promise<void> => {
  const { songid } = getTypedQuery<{ songid?: string }>(ctx);
  const songId = Number(songid);
  if (!Number.isFinite(songId) || songId <= 0) {
    ctx.status = 400;
    ctx.body = { code: 400, message: 'songid is required' };
    return;
  }
  const data = await services.recommend.radioDislike({
    token: getAuthToken(ctx),
    songId,
  });
  if (!data) return unauthorized(ctx);
  ctx.status = 200;
  ctx.body = { code: 200, data };
};

/** 首页推荐信息流。`v_cache` 决定翻页还是换一批。 */
export const recommendFeed = async (ctx: Context): Promise<void> => {
  const { page, direction, s_num, v_cache } = getTypedQuery<{
    page?: string;
    direction?: string;
    s_num?: string;
    v_cache?: string;
  }>(ctx);
  const data = await services.recommend.getRecommendFeed({
    token: getAuthToken(ctx),
    page: Number(page),
    direction: Number(direction),
    sNum: Number(s_num),
    // 逗号分隔，避免为一次翻页引入一个数组解析器
    vCache: typeof v_cache === 'string' && v_cache ? v_cache.split(',').filter(Boolean) : undefined,
  });
  if (!data) return unauthorized(ctx);
  const shelves = Array.isArray(data.v_shelf) ? data.v_shelf : [];
  ctx.status = 200;
  ctx.body = { code: 200, shelves, loadMark: data.load_mark ?? 0 };
};

/** 雷达：按账号红心推相似歌。 */
export const radarRecommend = async (ctx: Context): Promise<void> => {
  const { page } = getTypedQuery<{ page?: string }>(ctx);
  const data = await services.recommend.getRadarRecommend({
    token: getAuthToken(ctx),
    page: Number(page),
  });
  if (!data) return unauthorized(ctx);
  ctx.status = 200;
  ctx.body = {
    code: 200,
    tracks: Array.isArray(data.tracks) ? data.tracks : [],
    hasMore: data.hasMore === true,
  };
};

/** 推荐歌单广场。 */
export const recommendPlaylists = async (ctx: Context): Promise<void> => {
  const { from, size } = getTypedQuery<{ from?: string; size?: string }>(ctx);
  const data = await services.recommend.getRecommendPlaylists({
    token: getAuthToken(ctx),
    from: Number(from),
    size: Number(size),
  });
  if (!data) return unauthorized(ctx);
  const playlists = Array.isArray(data.playlists) ? data.playlists : [];
  ctx.status = 200;
  ctx.body = { code: 200, playlists, total: playlists.length, more: data.hasMore === true };
};

/** 新歌速递。 */
export const newSongs = async (ctx: Context): Promise<void> => {
  const { type } = getTypedQuery<{ type?: string }>(ctx);
  const data = await services.recommend.getNewSongs({
    token: getAuthToken(ctx),
    type: Number(type),
  });
  if (!data) return unauthorized(ctx);
  ctx.status = 200;
  ctx.body = {
    code: 200,
    songs: Array.isArray(data.songs) ? data.songs : [],
    language: data.language,
    categories: Array.isArray(data.categories) ? data.categories : [],
  };
};

/** 相似歌曲：按一首种子歌推同类。缺 songid 直接 400 —— 拿不到种子就没什么可推的。 */
export const similarSongs = async (ctx: Context): Promise<void> => {
  const { songid } = getTypedQuery<{ songid?: string }>(ctx);
  const seed = String(songid ?? '').trim();
  if (!seed) {
    ctx.status = 400;
    ctx.body = { code: 400, message: 'songid is required' };
    return;
  }
  const data = await services.recommend.getSimilarSongs({
    token: getAuthToken(ctx),
    songid: seed,
  });
  if (!data) return unauthorized(ctx);
  ctx.status = 200;
  ctx.body = {
    code: 200,
    tracks: Array.isArray(data.tracks) ? data.tracks : [],
    total: Array.isArray(data.tracks) ? data.tracks.length : 0,
  };
};

/** 红心（写进「我喜欢」目录）。缺 songid 直接 400。 */
export const likeSong = async (ctx: Context): Promise<void> => {
  const { songid } = getTypedQuery<{ songid?: string }>(ctx);
  const id = Number(songid);
  if (!Number.isFinite(id) || id <= 0) {
    ctx.status = 400;
    ctx.body = { code: 400, message: 'songid (numeric) is required' };
    return;
  }
  const data = await services.recommend.likeSong({ token: getAuthToken(ctx), songId: id });
  if (!data) return unauthorized(ctx);
  ctx.status = 200;
  ctx.body = { code: 200, liked: true, songid: id };
};

/** 取消红心。 */
export const unlikeSong = async (ctx: Context): Promise<void> => {
  const { songid } = getTypedQuery<{ songid?: string }>(ctx);
  const id = Number(songid);
  if (!Number.isFinite(id) || id <= 0) {
    ctx.status = 400;
    ctx.body = { code: 400, message: 'songid (numeric) is required' };
    return;
  }
  const data = await services.recommend.unlikeSong({ token: getAuthToken(ctx), songId: id });
  if (!data) return unauthorized(ctx);
  ctx.status = 200;
  ctx.body = { code: 200, liked: false, songid: id };
};

/** 往自建歌单加/删歌。收藏来的歌单不可写，上游会拒。 */
export const playlistSongs = async (ctx: Context): Promise<void> => {
  const { dirid, operation, songids } = getTypedQuery<{
    dirid?: string;
    operation?: string;
    songids?: string;
  }>(ctx);
  const dirId = Number(dirid);
  const ids = String(songids ?? '')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (!Number.isFinite(dirId) || dirId <= 0 || ids.length === 0) {
    ctx.status = 400;
    ctx.body = {
      code: 400,
      message: 'dirid and songids (comma separated numeric ids) are required',
    };
    return;
  }
  const call =
    operation === 'del' ? services.recommend.delPlaylistSongs : services.recommend.addPlaylistSongs;
  const data = await call({ token: getAuthToken(ctx), dirId, songIds: ids });
  if (!data) return unauthorized(ctx);
  ctx.status = 200;
  ctx.body = {
    code: 200,
    operation: operation === 'del' ? 'del' : 'add',
    dirid: dirId,
    songids: ids,
  };
};

/** 新建自建歌单。 */
export const createPlaylist = async (ctx: Context): Promise<void> => {
  const { dirname } = getTypedQuery<{ dirname?: string }>(ctx);
  const name = String(dirname ?? '').trim();
  if (!name) {
    ctx.status = 400;
    ctx.body = { code: 400, message: 'dirname is required' };
    return;
  }
  const data = await services.recommend.createPlaylist({ token: getAuthToken(ctx), dirName: name });
  if (!data) return unauthorized(ctx);
  ctx.status = 200;
  ctx.body = { code: 200, data };
};

export default {
  guessRecommend,
  recommendFeed,
  radarRecommend,
  recommendPlaylists,
  newSongs,
  similarSongs,
};
