const SECURE_CONTEXT_ERROR = 'PWA 需要通过 localhost 或 HTTPS 打开，当前页面不是安全上下文，浏览器未提供 WebCrypto。'

let cachedCrypto: Crypto | undefined

export function requireWebCrypto(): Crypto {
  if (cachedCrypto) return cachedCrypto
  if (!globalThis.isSecureContext) {
    throw new Error(SECURE_CONTEXT_ERROR)
  }
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.subtle) {
    throw new Error('浏览器未提供 WebCrypto Subtle API，请使用支持现代 Web 标准的浏览器。')
  }
  cachedCrypto = cryptoApi
  return cachedCrypto
}
