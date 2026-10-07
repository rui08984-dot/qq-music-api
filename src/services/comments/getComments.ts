import { AxiosRequestConfig } from 'axios';
import { logServiceFailure, logServiceRequest, logServiceSuccess } from '../../util/observability';
import y_common from '../y_common';

interface GetCommentsParams {
  method?: string;
  params?: Record<string, unknown>;
  option?: AxiosRequestConfig;
}

const upstream = '/base/fcgi-bin/fcg_global_comment_h5.fcg';

export default ({ method = 'get', params = {}, option = {} }: GetCommentsParams) => {
  // 默认值是兜底而不是压顶：调用方（评论点赞要按 h5 页实发的 cv/needmusiccrit）显式传了就听它的。
  const data = Object.assign(
    {
      format: 'json',
      outCharset: 'GB2312',
      domain: 'qq.com',
      ct: 24,
      cv: 10101010,
      needmusiccrit: 0,
    },
    params,
  );
  const options = Object.assign(option, { params: data });
  // 日志绝不带登录 key：点赞请求把凭证放进了 query（loginh5key/cookie），落盘前一律遮蔽。
  const logData: Record<string, unknown> = { ...data };
  if (logData.loginh5key) logData.loginh5key = '*** MASKED ***';
  if (logData.cookie) logData.cookie = '*** MASKED ***';
  logServiceRequest('getComments', upstream, logData);
  return y_common({
    url: upstream,
    method,
    options,
  })
    .then((res: import('axios').AxiosResponse<any>) => {
      const response = res.data;
      logServiceSuccess('getComments', upstream, response, {
        topId: data.topid,
      });
      return {
        status: 200,
        body: {
          response,
        },
      };
    })
    .catch((error: unknown) => {
      logServiceFailure('getComments', upstream, error, logData);
      return {
        status: 500,
        body: {
          error,
        },
      };
    });
};
