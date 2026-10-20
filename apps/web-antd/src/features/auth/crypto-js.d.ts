declare module 'crypto-js' {
  interface WordArray {
    toString(): string;
  }
  const crypto: {
    AES: {
      encrypt(
        value: string,
        key: WordArray,
        options: { mode: unknown; padding: unknown },
      ): WordArray;
    };
    enc: { Utf8: { parse(value: string): WordArray } };
    mode: { ECB: unknown };
    pad: { Pkcs7: unknown };
  };
  export default crypto;
}
