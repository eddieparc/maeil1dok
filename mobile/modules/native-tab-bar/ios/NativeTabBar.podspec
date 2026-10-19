Pod::Spec.new do |s|
  s.name           = 'NativeTabBar'
  s.version        = '1.0.0'
  s.summary        = 'SwiftUI bottom tab bar for Maeil1Dok iOS.'
  s.description    = 'A SwiftUI-hosted iOS-only bottom tab bar for Maeil1Dok.'
  s.homepage       = 'https://github.com/eddieparc/maeil1dok'
  s.license        = { :type => 'MIT' }
  s.authors        = { 'Maeil1Dok' => 'dev@maeil1dok.app' }
  s.source         = { :git => 'https://github.com/eddieparc/maeil1dok.git', :tag => s.version.to_s }
  s.platform       = :ios, '15.1'
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.dependency       'ExpoModulesCore'
  s.swift_version  = '5.9'
end
