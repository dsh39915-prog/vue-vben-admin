import type { AuthApi } from '#/api';

export interface CaptchaInstance {
  destroyCaptcha: () => void;
  refresh: () => void;
}
export interface CaptchaVerifyResult {
  bizResult: boolean;
  captchaResult: boolean;
}
export interface CaptchaOptions {
  SceneId: string;
  button: string;
  captchaVerifyCallback: (parameter: string) => Promise<CaptchaVerifyResult>;
  element: string;
  getInstance: (instance?: CaptchaInstance | null) => void;
  language: 'cn';
  mode: 'embed';
  onError: () => void;
  slideStyle: { height: number; width: number };
}
export type CaptchaInitializer = (options: CaptchaOptions) => unknown;
export type CaptchaWindow = Window & {
  AliyunCaptchaConfig?: { prefix: string; region: string };
  initAliyunCaptcha?: CaptchaInitializer;
};

let scriptRequest: Promise<void> | undefined;

/** 必须先设置设备采集配置，再动态加载官方脚本；不缓存或部署 SDK 副本。 */
export async function loadAliyunCaptcha(config: AuthApi.CaptchaConfig) {
  const sdkWindow = window as CaptchaWindow;
  sdkWindow.AliyunCaptchaConfig = {
    prefix: config.prefix,
    region: config.region ?? 'cn',
  };
  if (sdkWindow.initAliyunCaptcha) return sdkWindow.initAliyunCaptcha;
  if (!scriptRequest) {
    scriptRequest = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => fail(), 15_000);
      function fail() {
        clearTimeout(timer);
        script.remove();
        reject(new Error('验证码脚本加载失败'));
      }
      script.src =
        'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
      script.async = true;
      script.addEventListener(
        'load',
        () => {
          clearTimeout(timer);
          if (sdkWindow.initAliyunCaptcha) resolve();
          else fail();
        },
        { once: true },
      );
      script.addEventListener('error', fail, { once: true });
      document.head.append(script);
    }).finally(() => {
      scriptRequest = undefined;
    });
  }
  await scriptRequest;
  if (!sdkWindow.initAliyunCaptcha) throw new Error('验证码 SDK 未就绪');
  return sdkWindow.initAliyunCaptcha;
}
