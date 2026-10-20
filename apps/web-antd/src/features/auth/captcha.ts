import CryptoJS from 'crypto-js';
/** AJ-Captcha uses AES ECB with PKCS7 padding and a UTF-8 secret. */
export function encryptCaptcha(value: string, secret?: string) {
  return secret
    ? CryptoJS.AES.encrypt(value, CryptoJS.enc.Utf8.parse(secret), {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      }).toString()
    : value;
}
