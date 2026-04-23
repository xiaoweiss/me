import * as dd from "dingtalk-jsapi";

const clientId = import.meta.env.VITE_DINGTALK_CLIENT_ID as string;

/** 从 URL 参数读取 corpId（钉钉工作台打开时自动注入 ?corpid=xxx） */
function getCorpIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("corpid") || "";
}

/** 是否运行在钉钉容器内 */
export function isDingTalkEnv(): boolean {
  return dd.env.platform !== "notInDingTalk";
}

/** 获取钉钉免登授权码 */
export function getAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isDingTalkEnv()) {
      reject(new Error("当前不在钉钉环境中"));
      return;
    }

    const corpId = getCorpIdFromUrl();
    if (!corpId) {
      reject(new Error("缺少 corpid 参数，请从钉钉工作台打开"));
      return;
    }

    if (!clientId) {
      reject(new Error("未配置 VITE_DINGTALK_CLIENT_ID"));
      return;
    }

    dd.ready(() => {
      dd.requestAuthCode({
        clientId,
        corpId,
        success: (res: { code: string }) => {
          resolve(res.code);
        },
        fail: (err: unknown) => {
          reject(new Error(`获取授权码失败: ${JSON.stringify(err)}`));
        },
      });
    });
  });
}
