self.resolveNotificationTargetUrl = function resolveNotificationTargetUrl(value, origin) {
  const url = new URL(value || '/notifications', origin)
  if (url.origin !== origin) {
    return new URL('/notifications', origin).href
  }
  return url.href
}
