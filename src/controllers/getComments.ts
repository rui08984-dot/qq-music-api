import services from '../services';
import qrLoginService from '../services/auth/qrLogin.node';
import { getAuthToken } from './login';

const { getComments } = services;

// comments: params error
// id: 专辑或者歌单请求结果的id
// rootcommentid: 上一次请求结果的最后一项, comment.commentlist[commentlist.length - 1].rootcommentid
// id=8220
// rootcommentid=album_8220_1003310416_1558068713
// cid=205360772
import { Context } from 'koa';

export default async (ctx: Context) => {
  const {
    id,
    pagesize = 25,
    pagenum = 0,
    cid = 205360772,
    cmd = 8,
    reqtype = 2,
    biztype = 1,
    rootcommentid = !pagenum && '',
  } = ctx.query;
  // koa 的 query 值永远是字符串：`pagenum=0` 传进来是 '0'（truthy），原来的 `!pagenum`
  // 会把首页误判成"需要 rootcommentid 的翻页"，于是没有游标的首屏请求被 400 拒收。
  // 显式转成数字再判首页。
  const pageNumNum = Number(pagenum) || 0;
  const checkrootcommentid = pageNumNum === 0 ? true : !!rootcommentid;

  const params = Object.assign({
    cid,
    reqtype,
    biztype,
    topid: id,
    cmd,
    pagenum: pageNumNum,
    pagesize,
    lasthotcommentid: rootcommentid,
  });

  // 评论「点赞」是写操作（cmd=3），旧式 h5 CGI 用登录 cookie 认人；读取仍匿名可用。
  // 需要登录时把 token 解析成凭证 cookie 附上；解析不到（未登录/过期）就回 401，
  // 让前端知道这是登录问题而不是网络故障。凭证只进上游请求头，绝不回写响应体。
  // 🔴 实测边界（2026-10-08）：这套 cookie/g_tk/loginh5key 全带齐后，上游对**安卓扫码凭证**
  // 仍回业务失败（不带 g_tk 是 1101 invalid token，带了是 code -1）——这个 h5 CGI 要的是
  // 网页端登录族。要真接通点赞：要么加 web 登录通道，要么用已证实的 musicu 评论模块；
  // 别在参数组合上继续猜。前端目前没声明 likeComment 能力，这条分支是未来的地基。
  const isPraise = Number(cmd) === 3;
  const cookie = isPraise ? await qrLoginService.getCookieHeader(getAuthToken(ctx)) : null;
  if (isPraise && !cookie) {
    ctx.status = 401;
    ctx.body = { code: 401, message: 'Comment praise requires a logged-in session' };
    return;
  }
  if (isPraise && cookie) {
    // h5 评论页的写法不止带 cookie：还把登录 key 当 query 参数回传（uin + loginh5key），
    // 并按 c.y.qq.com 惯例带 g_tk —— 对 qm_keyst 的 djb2 哈希（上游用它校验"token"，
    // 缺了/错了就回 1101 invalid token）。两个值都从服务端凭证 cookie 串里现取，
    // 绝不下发给客户端、绝不进日志。
    const pick = (name: string): string => {
      const entry = cookie.split(';').find((part) => part.trim().startsWith(`${name}=`));
      return entry ? entry.slice(entry.indexOf('=') + 1).trim() : '';
    };
    const key = pick('qm_keyst');
    let hash = 5381;
    for (let i = 0; i < key.length; i += 1) {
      hash += (hash << 5) + key.charCodeAt(i);
      hash |= 0;
    }
    // 其余参数逐条抄 h5 评论页的实发请求（ct/cv 版本对、需要音乐评论标记、空 ua/cookie 占位）。
    Object.assign(params, {
      uin: pick('uin'),
      loginh5key: key,
      g_tk: hash & 0x7fffffff,
      ct: 24,
      cv: 4747474,
      needmusiccrit: 1,
      ua: '',
      cookie: '',
    });
  }

  const props = {
    method: 'get',
    params,
    option: cookie ? { headers: { cookie } } : {},
  };
  if (id && checkrootcommentid) {
    const { status, body } = await getComments(props);
    Object.assign(ctx, {
      status,
      body,
    });
  } else {
    ctx.status = 400;
    ctx.body = {
      data: {
        message: "Don't have id or rootcommentid",
      },
    };
  }
};
