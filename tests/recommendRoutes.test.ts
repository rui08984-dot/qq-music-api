jest.mock('../src/services', () => ({
  __esModule: true,
  default: {
    recommend: {
      getGuessRecommend: jest.fn(),
      radioDislike: jest.fn(),
      getRecommendFeed: jest.fn(),
      getRadarRecommend: jest.fn(),
      getRecommendPlaylists: jest.fn(),
      getNewSongs: jest.fn(),
      getSimilarSongs: jest.fn(),
      likeSong: jest.fn(),
      unlikeSong: jest.fn(),
      addPlaylistSongs: jest.fn(),
      delPlaylistSongs: jest.fn(),
      createPlaylist: jest.fn(),
    },
  },
}));

jest.mock('../src/util/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import type { Context } from 'koa';
import {
  createPlaylist,
  guessRecommend,
  likeSong,
  newSongs,
  playlistSongs,
  radarRecommend,
  radioDislike,
  recommendFeed,
  recommendPlaylists,
  similarSongs,
  unlikeSong,
} from '../src/controllers/recommend';
import services from '../src/services';

// src/controllers/recommend.ts 的行为收口：401（未登录）、400（缺参）、200 的字段映射，
// 以及 query 到服务层参数的转换（v_cache 拆数组、operation 选 add/del）。

const mockedRecommend = (
  services as unknown as {
    recommend: Record<string, jest.Mock>;
  }
).recommend;

const TOKEN = 'opaque-session-token';

/** 构造一个最小可用的 koa Context：query 走 GET 语义，body/status 直接读写。 */
const makeCtx = (query: Record<string, string> = {}, token?: string): Context => {
  const headers: Record<string, string> = {};
  if (token) headers['x-qq-session'] = token;
  return {
    query,
    headers,
    get: (name: string) => headers[name.toLowerCase()] ?? '',
    cookies: { get: () => undefined },
    status: 200,
    body: undefined as unknown,
  } as unknown as Context;
};

describe('recommend controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('guessRecommend', () => {
    it('已登录：把 num 与 token 传给服务层，回 200 与 tracks/total', async () => {
      mockedRecommend.getGuessRecommend.mockResolvedValueOnce({ tracks: [{ id: 1 }] });
      const ctx = makeCtx({ num: '20' }, TOKEN);

      await guessRecommend(ctx);

      expect(mockedRecommend.getGuessRecommend).toHaveBeenCalledWith({ token: TOKEN, num: 20 });
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({ code: 200, tracks: [{ id: 1 }], total: 1 });
    });

    it('未登录（服务层返回 null）：401，body 带 code 401', async () => {
      mockedRecommend.getGuessRecommend.mockResolvedValueOnce(null);
      const ctx = makeCtx({});

      await guessRecommend(ctx);

      expect(ctx.status).toBe(401);
      expect(ctx.body).toMatchObject({ code: 401 });
    });

    it('服务层抛错（凭据被拒）：错误原样冒出，由全局错误处理转状态码', async () => {
      mockedRecommend.getGuessRecommend.mockRejectedValueOnce(new Error('credential rejected'));
      const ctx = makeCtx({}, TOKEN);

      await expect(guessRecommend(ctx)).rejects.toThrow('credential rejected');
    });
  });

  describe('radioDislike', () => {
    it('已登录：songid 转数字后传给服务层', async () => {
      mockedRecommend.radioDislike.mockResolvedValueOnce({ code: 0 });
      const ctx = makeCtx({ songid: '12345' }, TOKEN);

      await radioDislike(ctx);

      expect(mockedRecommend.radioDislike).toHaveBeenCalledWith({ token: TOKEN, songId: 12345 });
      expect(ctx.status).toBe(200);
    });

    it('songid 缺失或不是正数：400', async () => {
      const cases: Record<string, string>[] = [{}, { songid: 'abc' }, { songid: '-1' }];
      for (const query of cases) {
        const ctx = makeCtx(query, TOKEN);
        await radioDislike(ctx);
        expect(ctx.status).toBe(400);
        expect(ctx.body).toMatchObject({ code: 400 });
      }
      expect(mockedRecommend.radioDislike).not.toHaveBeenCalled();
    });
  });

  describe('recommendFeed', () => {
    it('v_cache 逗号分隔拆成数组传给服务层', async () => {
      mockedRecommend.getRecommendFeed.mockResolvedValueOnce({
        v_shelf: [{ id: 's1' }],
        load_mark: 'mark-2',
      });
      const ctx = makeCtx({ page: '2', direction: '1', s_num: '6', v_cache: 'a,,b' }, TOKEN);

      await recommendFeed(ctx);

      expect(mockedRecommend.getRecommendFeed).toHaveBeenCalledWith({
        token: TOKEN,
        page: 2,
        direction: 1,
        sNum: 6,
        vCache: ['a', 'b'],
      });
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({ code: 200, shelves: [{ id: 's1' }], loadMark: 'mark-2' });
    });

    it('未带 v_cache：服务层收到 undefined 而不是空数组', async () => {
      mockedRecommend.getRecommendFeed.mockResolvedValueOnce({ v_shelf: [] });
      const ctx = makeCtx({}, TOKEN);

      await recommendFeed(ctx);

      expect(mockedRecommend.getRecommendFeed).toHaveBeenCalledWith(
        expect.objectContaining({ vCache: undefined }),
      );
    });
  });

  describe('radarRecommend', () => {
    it('已登录：回 tracks 与 hasMore', async () => {
      mockedRecommend.getRadarRecommend.mockResolvedValueOnce({ tracks: [1], hasMore: true });
      const ctx = makeCtx({ page: '3' }, TOKEN);

      await radarRecommend(ctx);

      expect(mockedRecommend.getRadarRecommend).toHaveBeenCalledWith({ token: TOKEN, page: 3 });
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({ code: 200, tracks: [1], hasMore: true });
    });
  });

  describe('recommendPlaylists', () => {
    it('已登录：回 playlists/total/more', async () => {
      mockedRecommend.getRecommendPlaylists.mockResolvedValueOnce({
        playlists: [{ id: 'p1' }, { id: 'p2' }],
        hasMore: false,
      });
      const ctx = makeCtx({ from: '0', size: '30' }, TOKEN);

      await recommendPlaylists(ctx);

      expect(mockedRecommend.getRecommendPlaylists).toHaveBeenCalledWith({
        token: TOKEN,
        from: 0,
        size: 30,
      });
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({
        code: 200,
        playlists: [{ id: 'p1' }, { id: 'p2' }],
        total: 2,
        more: false,
      });
    });
  });

  describe('newSongs', () => {
    it('已登录：type 转数字，回 songs/language/categories', async () => {
      mockedRecommend.getNewSongs.mockResolvedValueOnce({
        songs: [{ mid: 'm1' }],
        language: 'zh',
        categories: [{ id: 3 }],
      });
      const ctx = makeCtx({ type: '3' }, TOKEN);

      await newSongs(ctx);

      expect(mockedRecommend.getNewSongs).toHaveBeenCalledWith({ token: TOKEN, type: 3 });
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({
        code: 200,
        songs: [{ mid: 'm1' }],
        language: 'zh',
        categories: [{ id: 3 }],
      });
    });
  });

  describe('similarSongs', () => {
    it('缺 songid：400，不打服务层', async () => {
      const ctx = makeCtx({}, TOKEN);

      await similarSongs(ctx);

      expect(ctx.status).toBe(400);
      expect(mockedRecommend.getSimilarSongs).not.toHaveBeenCalled();
    });

    it('已登录：songid 原样透传（字符串），回 tracks/total', async () => {
      mockedRecommend.getSimilarSongs.mockResolvedValueOnce({ tracks: [{ mid: 'm' }] });
      const ctx = makeCtx({ songid: '4830342' }, TOKEN);

      await similarSongs(ctx);

      expect(mockedRecommend.getSimilarSongs).toHaveBeenCalledWith({
        token: TOKEN,
        songid: '4830342',
      });
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({ code: 200, total: 1 });
    });
  });

  describe('likeSong / unlikeSong', () => {
    it('红心：songid 转数字，回 liked: true', async () => {
      mockedRecommend.likeSong.mockResolvedValueOnce({ code: 0 });
      const ctx = makeCtx({ songid: '42' }, TOKEN);

      await likeSong(ctx);

      expect(mockedRecommend.likeSong).toHaveBeenCalledWith({ token: TOKEN, songId: 42 });
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({ code: 200, liked: true, songid: 42 });
    });

    it('取消红心：回 liked: false', async () => {
      mockedRecommend.unlikeSong.mockResolvedValueOnce({ code: 0 });
      const ctx = makeCtx({ songid: '42' }, TOKEN);

      await unlikeSong(ctx);

      expect(mockedRecommend.unlikeSong).toHaveBeenCalledWith({ token: TOKEN, songId: 42 });
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({ code: 200, liked: false });
    });

    it('songid 非法：400', async () => {
      const ctx = makeCtx({}, TOKEN);
      await likeSong(ctx);
      expect(ctx.status).toBe(400);
      expect(mockedRecommend.likeSong).not.toHaveBeenCalled();
    });
  });

  describe('playlistSongs', () => {
    it('operation 缺省是 add：调 addPlaylistSongs', async () => {
      mockedRecommend.addPlaylistSongs.mockResolvedValueOnce({ code: 0 });
      const ctx = makeCtx({ dirid: '77', songids: '1, 2,3' }, TOKEN);

      await playlistSongs(ctx);

      expect(mockedRecommend.addPlaylistSongs).toHaveBeenCalledWith({
        token: TOKEN,
        dirId: 77,
        songIds: [1, 2, 3],
      });
      expect(mockedRecommend.delPlaylistSongs).not.toHaveBeenCalled();
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({
        code: 200,
        operation: 'add',
        dirid: 77,
        songids: [1, 2, 3],
      });
    });

    it('operation=del：调 delPlaylistSongs', async () => {
      mockedRecommend.delPlaylistSongs.mockResolvedValueOnce({ code: 0 });
      const ctx = makeCtx({ dirid: '77', songids: '9', operation: 'del' }, TOKEN);

      await playlistSongs(ctx);

      expect(mockedRecommend.delPlaylistSongs).toHaveBeenCalledWith({
        token: TOKEN,
        dirId: 77,
        songIds: [9],
      });
      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({ code: 200, operation: 'del' });
    });

    it('dirid 或 songids 非法：400（songids 里的非数字项被过滤后为空也算）', async () => {
      const cases: Record<string, string>[] = [
        {},
        { dirid: '0', songids: '1' },
        { dirid: '77', songids: 'x,y' },
      ];
      for (const query of cases) {
        const ctx = makeCtx(query, TOKEN);
        await playlistSongs(ctx);
        expect(ctx.status).toBe(400);
      }
      expect(mockedRecommend.addPlaylistSongs).not.toHaveBeenCalled();
      expect(mockedRecommend.delPlaylistSongs).not.toHaveBeenCalled();
    });
  });

  describe('createPlaylist', () => {
    it('已登录：dirname 去首尾空白后传给服务层', async () => {
      mockedRecommend.createPlaylist.mockResolvedValueOnce({ code: 0, id: 900 });
      const ctx = makeCtx({ dirname: '  我的歌单  ' }, TOKEN);

      await createPlaylist(ctx);

      expect(mockedRecommend.createPlaylist).toHaveBeenCalledWith({
        token: TOKEN,
        dirName: '我的歌单',
      });
      expect(ctx.status).toBe(200);
    });

    it('dirname 为空白：400', async () => {
      const ctx = makeCtx({ dirname: '   ' }, TOKEN);

      await createPlaylist(ctx);

      expect(ctx.status).toBe(400);
      expect(mockedRecommend.createPlaylist).not.toHaveBeenCalled();
    });
  });
});
