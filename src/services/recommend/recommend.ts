import qrLoginService from '../auth/qrLogin.node';

// src/services/recommend/recommend.ts
// 推荐面向的五路请求，统一走扫码登录态。匿名调用拿不到个性化结果，理由见 auth/qrLogin.ts 里
// 这组函数上方的注释，这里只做参数转发与缺省值收口。

export interface GuessRecommendParams {
  token?: string;
  /** 上游默认只回 5 条；刷歌需要连续拉取，调用方应当显式传一个更大的值。 */
  num?: number;
}

export interface RadioDislikeParams {
  token?: string;
  /** 单曲的数字 songId（mid 转换在调用方完成）。 */
  songId?: number;
}

export interface RecommendFeedParams {
  token?: string;
  page?: number;
  /** `1` 表示换一批而不是翻下一页。 */
  direction?: number;
  sNum?: number;
  /** 已曝光的 shelf id 游标，由上游定义翻页语义。 */
  vCache?: string[];
}

export interface RadarRecommendParams {
  token?: string;
  page?: number;
}

export interface RecommendPlaylistsParams {
  token?: string;
  from?: number;
  size?: number;
}

export interface NewSongsParams {
  token?: string;
  /** 1 内地 / 2 欧美 / 3 日本 / 4 韩国 / 5 最新 / 6 港台。 */
  type?: number;
}

export interface LikeSongParams {
  token?: string;
  songId?: number;
}

export interface PlaylistSongsParams {
  token?: string;
  dirId?: number;
  songIds?: number[];
}

export interface CreatePlaylistParams {
  token?: string;
  dirName?: string;
}

export interface SimilarSongsParams {
  token?: string;
  /** 种子歌的数字 id 或 songmid。上游只认 `songid` 一个键，多传参数会回 code 10006。 */
  songid?: string | number;
}

export const getGuessRecommend = ({ token, num }: GuessRecommendParams = {}) =>
  qrLoginService.getGuessRecommend(token, num);

export const radioDislike = ({ token, songId }: RadioDislikeParams = {}) =>
  qrLoginService.getRadioDislike(token, songId);

export const getRecommendFeed = ({
  token,
  page,
  direction,
  sNum,
  vCache,
}: RecommendFeedParams = {}) =>
  qrLoginService.getRecommendFeed(token, { page, direction, sNum, vCache });

export const getRadarRecommend = ({ token, page }: RadarRecommendParams = {}) =>
  qrLoginService.getRadarRecommend(token, page);

export const getRecommendPlaylists = ({ token, from, size }: RecommendPlaylistsParams = {}) =>
  qrLoginService.getRecommendPlaylists(token, from, size);

export const getNewSongs = ({ token, type }: NewSongsParams = {}) =>
  qrLoginService.getNewSongs(token, type);

export const getSimilarSongs = ({ token, songid }: SimilarSongsParams = {}) =>
  qrLoginService.getSimilarSongs(token, songid);

export const likeSong = ({ token, songId }: LikeSongParams = {}) =>
  qrLoginService.getLikeSong(token, songId);

export const unlikeSong = ({ token, songId }: LikeSongParams = {}) =>
  qrLoginService.getUnlikeSong(token, songId);

export const addPlaylistSongs = ({ token, dirId, songIds }: PlaylistSongsParams = {}) =>
  qrLoginService.getAddPlaylistSongs(token, dirId, songIds);

export const delPlaylistSongs = ({ token, dirId, songIds }: PlaylistSongsParams = {}) =>
  qrLoginService.getDelPlaylistSongs(token, dirId, songIds);

export const createPlaylist = ({ token, dirName }: CreatePlaylistParams = {}) =>
  qrLoginService.getCreatePlaylist(token, dirName);

export default {
  getGuessRecommend,
  radioDislike,
  getRecommendFeed,
  getRadarRecommend,
  getRecommendPlaylists,
  getNewSongs,
  getSimilarSongs,
  likeSong,
  unlikeSong,
  addPlaylistSongs,
  delPlaylistSongs,
  createPlaylist,
};
