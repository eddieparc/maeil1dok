const { withGradleProperties } = require('expo/config-plugins')

/**
 * Give Gradle enough metaspace to run KSP.
 *
 * `:expo-updates:kspReleaseKotlin` died with `OutOfMemoryError: Metaspace` on the
 * Expo template default. It is a config plugin rather than an edit to
 * `android/gradle.properties` because that directory is gitignored and, more to
 * the point, `eas build --local` prebuilds into a fresh temp directory — an edit
 * to the checked-out copy would never be seen by the build that actually ships.
 */
const PROPERTIES = {
  'org.gradle.jvmargs': '-Xmx6144m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8',
}

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPERTIES)) {
      const index = cfg.modResults.findIndex(
        (item) => item.type === 'property' && item.key === key,
      )
      const entry = { type: 'property', key, value }
      if (index >= 0) cfg.modResults[index] = entry
      else cfg.modResults.push(entry)
    }
    return cfg
  })
}
