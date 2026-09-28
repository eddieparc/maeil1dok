const { withPodfile } = require('expo/config-plugins')

/**
 * Raise every Pods target to the React Native minimum iOS version.
 *
 * Xcode 27 rejects deployment targets below iOS 15. RN's own post_install only
 * rewrites pod library targets, so resource-bundle targets such as
 * `KakaoSDKCommon-KakaoSDKCommon` or `RNCAsyncStorage-RNCAsyncStorage_resources`
 * keep their podspec floor (10.0–13.4) and fail the archive. Like
 * withGradleMemory, this is a config plugin because `eas build --local`
 * prebuilds into a fresh temp directory.
 */
const MIN_IOS = '15.1'
const MARKER = '# withPodsDeploymentTarget'

module.exports = function withPodsDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults.contents
    if (podfile.includes(MARKER)) return cfg

    const snippet = [
      `    ${MARKER}`,
      '    installer.pods_project.targets.each do |target|',
      '      target.build_configurations.each do |build_config|',
      "        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
      `        if current.nil? || current.to_f < ${MIN_IOS}`,
      `          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'`,
      '        end',
      '      end',
      '    end',
    ].join('\n')

    const anchor = /post_install do \|installer\|\n/
    if (!anchor.test(podfile)) {
      throw new Error('withPodsDeploymentTarget: post_install block not found in Podfile')
    }
    cfg.modResults.contents = podfile.replace(anchor, (m) => `${m}${snippet}\n`)
    return cfg
  })
}
