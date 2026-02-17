const { withAppBuildGradle, withProjectBuildGradle, withDangerousMod, withAndroidManifest, withGradleProperties, withPodfile } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Unified Expo Config Plugin for Crispy Native Android.
 * Consolidates NDK fixes, AAR dependencies, ABI splits, packaging options,
 * and fixes for Bridgeless mode compatibility.
 */
const withCrispyNative = (config) => {
    // 0. Add Frostwire Maven Repository
    config = withFrostwireMavenRepo(config);

    // 1. Force NDK version in top-level build.gradle
    config = withNdkFix(config);

    // 2. Manage Local AARs (Copying & Dependencies)
    config = withLocalAarDependencies(config);

    // 3. Android App Configuration (Splits & Packaging)
    config = withAppConfiguration(config);

    // 4. Ensure native libs are extracted (required for TorrServer exec)
    config = withExtractNativeLibs(config);

    // 5. Picture-in-Picture Support
    config = withAndroidManifestPiP(config);

    // 6. Enable Bridgeless Mode (Required by Reanimated v4)
    config = withBridgelessEnabled(config);

    // 7. Add Audio Permissions & Media Receiver
    config = withAudioConfig(config);

    // 8. Enforce localhost-only cleartext policy for local streaming
    config = withLocalhostCleartextPolicy(config);

    // 9. Add ProGuard Rules
    config = withProGuardRules(config);

    // 10. iOS Podfile Configuration (KSPlayer)
    config = withIosConfiguration(config);

    return config;
};

// --- Sub-Plugins ---

/**
 * Configure iOS Podfile to include KSPlayer and its dependencies from git source.
 */
const withIosConfiguration = (config) => {
    return withPodfile(config, (config) => {
        let podfileContent = config.modResults.contents;

        // Ensure use_modular_headers! is globally enabled for Swift static libraries compatibility
        if (!podfileContent.includes('use_modular_headers!')) {
            if (podfileContent.includes('use_expo_modules!')) {
                podfileContent = podfileContent.replace(
                    'use_expo_modules!',
                    `use_modular_headers!\n  use_expo_modules!`
                );
            }
        }

        // Inhibit all warnings from pods to keep logs clean
        if (!podfileContent.includes('inhibit_all_warnings!')) {
            podfileContent = podfileContent.replace(
                /platform :ios, .*/,
                `$&\ninhibit_all_warnings!`
            );
        }


        
        // Define pods as per KSPlayer README
        const ksPlayerPod = `pod 'KSPlayer', :git => 'https://github.com/kingslay/KSPlayer.git', :branch => 'main'`;
        const displayCriteriaPod = `pod 'DisplayCriteria', :git => 'https://github.com/kingslay/KSPlayer.git', :branch => 'main'`;
        const ffmpegKitPod = `pod 'FFmpegKit', :git => 'https://github.com/kingslay/FFmpegKit.git', :branch => 'main'`;
        const libassPod = `pod 'Libass', :git => 'https://github.com/kingslay/FFmpegKit.git', :branch => 'main'`;

        const insertPod = (podString, podName) => {
            if (!podfileContent.includes(`pod '${podName}'`)) {
                if (podfileContent.includes('use_expo_modules!')) {
                    podfileContent = podfileContent.replace(
                        'use_expo_modules!',
                        `${podString}\n  use_expo_modules!`
                    );
                } else {
                    podfileContent += `\n${podString}\n`;
                }
            }
        };

        insertPod(ksPlayerPod, 'KSPlayer');
        insertPod(displayCriteriaPod, 'DisplayCriteria');
        insertPod(ffmpegKitPod, 'FFmpegKit');
        insertPod(libassPod, 'Libass');

        // Suppress "umbrella header for module 'React' does not include header..." warnings
        const warningSuppression = `
    # Suppress "umbrella header for module 'React' does not include header..." warnings
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['OTHER_CFLAGS'] ||= '$(inherited) '
        unless config.build_settings['OTHER_CFLAGS'].include?('-Wno-incomplete-umbrella')
          config.build_settings['OTHER_CFLAGS'] << ' -Wno-incomplete-umbrella'
        end
      end
    end`;

        if (!podfileContent.includes('-Wno-incomplete-umbrella')) {
            // Try to insert it inside the post_install block, after react_native_post_install
            const postInstallPattern = /react_native_post_install\([\s\S]*?\n\s*\)/;
            if (postInstallPattern.test(podfileContent)) {
                podfileContent = podfileContent.replace(
                    postInstallPattern,
                    `$&${warningSuppression}`
                );
            }
        }

        config.modResults.contents = podfileContent;
        return config;
    });
};

/**
 * Enable Bridgeless mode.
 * Reanimated v4 throws in dev when RN$Bridgeless is not enabled.
 * Adds react.bridgelessEnabled=true to gradle.properties.
 */
const withBridgelessEnabled = (config) => {
    return withGradleProperties(config, (config) => {
        config.modResults.push({
            type: 'property',
            key: 'react.bridgelessEnabled',
            value: 'true',
        });
        return config;
    });
};

/**
 * Add required Audio permissions and MediaButtonReceiver.
 */
const withAudioConfig = (config) => {
    return withAndroidManifest(config, (config) => {
        const androidManifest = config.modResults.manifest;

        // 1. Add Permissions
    const permissionsToAdd = [
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ];

        if (!androidManifest['uses-permission']) {
            androidManifest['uses-permission'] = [];
        }

        permissionsToAdd.forEach((permission) => {
            if (!androidManifest['uses-permission'].some((p) => p['$']['android:name'] === permission)) {
                androidManifest['uses-permission'].push({
                    $: { 'android:name': permission },
                });
            }
        });

        // 2. Add MediaButtonReceiver
        const mainApplication = androidManifest.application[0];
        if (!mainApplication.receiver) {
            mainApplication.receiver = [];
        }

        const receiverName = 'androidx.media.session.MediaButtonReceiver';
        if (!mainApplication.receiver.some((r) => r['$']['android:name'] === receiverName)) {
            mainApplication.receiver.push({
                $: {
                    'android:name': receiverName,
                    'android:exported': 'true',
                },
                'intent-filter': [
                    {
                        action: [{ $: { 'android:name': 'android.intent.action.MEDIA_BUTTON' } }],
                    },
                ],
            });
        }

        return config;
    });
};

/**
 * Enforce deny-by-default cleartext policy for release and relax in debug only.
 * Release keeps localhost-only cleartext for local torrent streaming.
 * Debug allows cleartext globally so Metro/dev tooling can connect over HTTP.
 */
const withLocalhostCleartextPolicy = (config) => {
    config = withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application?.[0];
        if (mainApplication?.$) {
            mainApplication.$['android:usesCleartextTraffic'] = 'false';
            mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
        }
        return config;
    });

    return withDangerousMod(config, [
        'android',
        async (config) => {
            const mainXmlDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
            const mainNetworkSecurityFile = path.join(mainXmlDir, 'network_security_config.xml');
            const debugXmlDir = path.join(config.modRequest.platformProjectRoot, 'app/src/debug/res/xml');
            const debugNetworkSecurityFile = path.join(debugXmlDir, 'network_security_config_debug.xml');
            const debugManifestDir = path.join(config.modRequest.platformProjectRoot, 'app/src/debug');
            const debugManifestFile = path.join(debugManifestDir, 'AndroidManifest.xml');

            const mainContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`;

            const debugContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true" />
</network-security-config>
`;

            const debugManifestContent = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
    <application
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config_debug"
        tools:replace="android:usesCleartextTraffic,android:networkSecurityConfig" />
</manifest>
`;

            fs.mkdirSync(mainXmlDir, { recursive: true });
            fs.mkdirSync(debugXmlDir, { recursive: true });
            fs.mkdirSync(debugManifestDir, { recursive: true });

            if (!fs.existsSync(mainNetworkSecurityFile) || fs.readFileSync(mainNetworkSecurityFile, 'utf8') !== mainContent) {
                fs.writeFileSync(mainNetworkSecurityFile, mainContent);
            }

            if (!fs.existsSync(debugNetworkSecurityFile) || fs.readFileSync(debugNetworkSecurityFile, 'utf8') !== debugContent) {
                fs.writeFileSync(debugNetworkSecurityFile, debugContent);
            }

            if (!fs.existsSync(debugManifestFile) || fs.readFileSync(debugManifestFile, 'utf8') !== debugManifestContent) {
                fs.writeFileSync(debugManifestFile, debugManifestContent);
            }

            return config;
        },
    ]);
};

/**
 * Add ProGuard rules for ExoPlayer and Media3.
 */
const withProGuardRules = (config) => {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const file = path.join(config.modRequest.platformProjectRoot, 'app/proguard-rules.pro');
            const contents = fs.readFileSync(file, 'utf8');
            const newRules = `
# ExoPlayer / react-native-video
-keep class com.google.android.exoplayer2.** { *; }
-keep class androidx.media3.** { *; }
`;
            if (!contents.includes('com.google.android.exoplayer2')) {
                fs.writeFileSync(file, contents + newRules);
            }
            return config;
        },
    ]);
};

/**
 * Force NDK version in top-level build.gradle.
 * Required for native player compatibility.
 */
const withNdkFix = (config) => {
    return withProjectBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            const targetNdkVersion = '29.0.14206865';
            let buildGradle = config.modResults.contents;

            if (!buildGradle.includes(`ndkVersion = "${targetNdkVersion}"`)) {
                if (buildGradle.includes('ext {')) {
                    if (buildGradle.match(/ndkVersion\s*=\s*/)) {
                        buildGradle = buildGradle.replace(/ndkVersion\s*=\s*["'].*?["']/, `ndkVersion = "${targetNdkVersion}"`);
                    } else {
                        buildGradle = buildGradle.replace(/ext\s*\{/, `ext {\n        ndkVersion = "${targetNdkVersion}"`);
                    }
                } else {
                    buildGradle = buildGradle.replace(/buildscript\s*\{/, `buildscript {\n    ext {\n        ndkVersion = "${targetNdkVersion}"\n    }`);
                }
                config.modResults.contents = buildGradle;
            }
        }
        return config;
    });
};

/**
 * Handle local AAR dependencies and file copying.
 */
const withLocalAarDependencies = (config) => {
    // VLC is now loaded via Maven, no manual AAR copying needed
    // jlibtorrent JARs are handled by the library build.gradle
    return config;
};

/**
 * Configure Splits and Packaging Options.
 */
const withAppConfiguration = (config) => {
    return withAppBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            let buildGradle = config.modResults.contents;

            // 1. ABI Splits
            if (!buildGradle.includes('splits {')) {
                const splitsBlock = `
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a', 'x86_64'
            universalApk true
        }
    }
    applicationVariants.all { variant ->
        variant.outputs.each { output ->
            def baseVersionCode = 1
            def abiName = output.getFilter(com.android.build.OutputFile.ABI)
            def abiVersionCodes = ['armeabi-v7a': 1, 'arm64-v8a': 2, 'x86_64': 3]
            if (abiName != null) {
                output.versionCodeOverride = baseVersionCode * 1000 + abiVersionCodes.get(abiName)
            }
        }
    }
`;
                buildGradle = buildGradle.replace(/android\s*\{/, `android {${splitsBlock}`);
            }

            // 2. Packaging Options (libc++_shared.so fix)
            if (!buildGradle.includes("pickFirst '**/libc++_shared.so'")) {
                const packagingOptions = `
    packagingOptions {
        jniLibs {
            useLegacyPackaging (findProperty('expo.useLegacyPackaging') ?: 'false').toBoolean()
            pickFirst '**/libc++_shared.so'
        }
    }
`;
                if (buildGradle.includes('packagingOptions {')) {
                    buildGradle = buildGradle.replace(/packagingOptions\s*\{\s*jniLibs\s*\{/, `packagingOptions {\n        jniLibs {\n            pickFirst '**/libc++_shared.so'`);
                } else {
                    buildGradle = buildGradle.replace(/android\s*\{/, `android {\n${packagingOptions}`);
                }
            }

            config.modResults.contents = buildGradle;
        }
        return config;
    });
};

/**
 * Force native libraries extraction.
 *
 * TorrServer is executed as a native payload from `ApplicationInfo.nativeLibraryDir`.
 * If native libs aren't extracted (extractNativeLibs=false), the executable may not
 * exist as a real filesystem path and process spawning will fail.
 */
const withExtractNativeLibs = (config) => {
    return withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application?.[0];
        if (mainApplication?.$) {
            mainApplication.$['android:extractNativeLibs'] = 'true';
        }
        return config;
    });
};

/**
 * Configure AndroidManifest for PiP support.
 */
const withAndroidManifestPiP = (config) => {
    return withAndroidManifest(config, (config) => {
        const mainActivity = config.modResults.manifest.application[0].activity.find(
            (activity) => activity.$['android:name'] === '.MainActivity'
        );

        if (mainActivity) {
            // 1. Enable PiP support
            mainActivity.$['android:supportsPictureInPicture'] = 'true';

            // 2. Add required configChanges
            const configChanges = mainActivity.$['android:configChanges'] || '';
            const requiredChanges = ['smallestScreenSize', 'screenLayout', 'screenSize'];

            let changesArr = configChanges.split('|').map(s => s.trim()).filter(Boolean);
            requiredChanges.forEach(change => {
                if (!changesArr.includes(change)) {
                    changesArr.push(change);
                }
            });
            mainActivity.$['android:configChanges'] = changesArr.join('|');

            console.log('withCrispyNative: Configured AndroidManifest for PiP support');
        } else {
            console.warn('withCrispyNative: MainActivity not found in AndroidManifest');
        }

        return config;
    });
};

module.exports = withCrispyNative;

/**
 * Add Frostwire Maven repository to root build.gradle.
 */
const withFrostwireMavenRepo = (config) => {
    return withProjectBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            let buildGradle = config.modResults.contents;
            if (!buildGradle.includes('https://dl.frostwire.com/maven')) {
                buildGradle = buildGradle.replace(
                    /allprojects\s*\{\s*repositories\s*\{/,
                    `allprojects {
        repositories {
            maven { url "https://oss.sonatype.org/content/repositories/releases" }
            maven {
                url "https://dl.frostwire.com/maven"
                content {
                    includeGroup "com.frostwire"
                }
            }`
                );
                config.modResults.contents = buildGradle;
            }
        }
        return config;
    });
};
