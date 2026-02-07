require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'CrispyNativeCore'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platform       = :ios, '13.0'
  s.source         = { git: 'https://github.com/aayushrautela/crispy-native.git', :tag => s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  
  # MobileVLCKit for VLC player support
  # Using 4.0.0a2 as latest stable alpha with iOS 13+ support
  s.dependency 'MobileVLCKit', '4.0.0a2'

  # KSPlayer for advanced video playback
  # Using git-based dependency since it's not in CocoaPods trunk
  s.dependency 'KSPlayer'

  # Swift/LLVM optimization flags
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'ENABLE_BITCODE' => 'NO',
    # Required for VLC
    'OTHER_LDFLAGS' => '-lxml2 -lz -lbz2 -liconv -lc++',
    'HEADER_SEARCH_PATHS' => '$(inherited) /usr/include/libxml2',
    # Required for KSPlayer/FFmpeg
    'FRAMEWORK_SEARCH_PATHS' => '$(inherited)',
    'LD_RUNPATH_SEARCH_PATHS' => '$(inherited) @executable_path/Frameworks @loader_path/Frameworks'
  }

  # User-facing app config
  s.user_target_xcconfig = {
    'ENABLE_BITCODE' => 'NO',
    'OTHER_LDFLAGS' => '-lxml2 -lz -lbz2 -liconv -lc++'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
