import { requestClient } from '#/api/request';
export interface CaptchaChallenge {
  originalImageBase64: string;
  jigsawImageBase64: string;
  token: string;
  secretKey?: string;
}
interface CaptchaResponse<T> {
  repCode: string;
  repMsg?: string;
  repData: T;
}
async function captchaRequest<T>(path: string, data: Record<string, unknown>) {
  const result = await requestClient.post<CaptchaResponse<T>>(
    '/system/captcha/' + path,
    data,
    { responseReturn: 'body' },
  );
  if (result.repCode !== '0000')
    throw new Error(result.repMsg || '图片验证失败，请重试');
  return result.repData;
}
export const getCaptchaApi = () =>
  captchaRequest<CaptchaChallenge>('get', {
    captchaType: 'blockPuzzle',
    clientUid: sessionStorage.getItem('captcha-client') || createClient(),
    ts: Date.now(),
  });
function createClient() {
  const id = 'slider-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  sessionStorage.setItem('captcha-client', id);
  return id;
}
export const checkCaptchaApi = (token: string, pointJson: string) =>
  captchaRequest<unknown>('check', {
    captchaType: 'blockPuzzle',
    token,
    pointJson,
  });
