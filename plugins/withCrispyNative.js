const { withAppBuildGradle, withProjectBuildGradle, withDangerousMod, withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Unified Expo Config Plugin for Crispy Native Android.
 * Consolidates NDK fixes, AAR dependencies, ABI splits, packaging options,
 * and fixes for Bridgeless mode compatibility.
 */
const withCrispyNative = (config) => {
    // 1. Force NDK version in top-level build.gradle
    config = withNdkFix(config);

    // 2. Manage Local AARs (Copying & Dependencies)
    config = withLocalAarDependencies(config);

    // 3. Android App Configuration (Splits & Packaging)
    config = withAppConfiguration(config);

    // 4. Picture-in-Picture Support
    config = withAndroidManifestPiP(config);

    // 5. Disable Bridgeless Mode (Fix for react-native-video / Legacy modules)
    config = withBridgelessDisabled(config);

    // 6. Add Audio Permissions & Media Receiver
    config = withAudioConfig(config);

    // 7. Add ProGuard Rules
    config = withProGuardRules(config);

    return config;
};

// --- Sub-Plugins ---

/**
 * Disable Bridgeless mode to support legacy modules like react-native-video.
 * Adds react.bridgelessEnabled=false to gradle.properties.
 */
const withBridgelessDisabled = (config) => {
    return withGradleProperties(config, (config) => {
        config.modResults.push({
            type: 'property',
            key: 'react.bridgelessEnabled',
            value: 'false',
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
 * Required for libmpv compatibility (NDK r29).
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
    // Step 1: Copy AAR files to android/app/libs
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const sourcePath = path.join(config.modRequest.projectRoot, 'modules/crispy-native-core/android/libs');
            const targetPath = path.join(config.modRequest.platformProjectRoot, 'app/libs');

            if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });

            const aarFiles = ['libmpv-release.aar', 'lib-decoder-ffmpeg-release.aar'];
            for (const aarFile of aarFiles) {
                const sourceFile = path.join(sourcePath, aarFile);
                if (fs.existsSync(sourceFile)) {
                    fs.copyFileSync(sourceFile, path.join(targetPath, aarFile));
                }
            }
            return config;
        },
    ]);

    // Step 2: Inject AAR dependencies into app build.gradle
    return withAppBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            if (!config.modResults.contents.includes('libmpv-release.aar')) {
                const aarDependencies = `
    implementation files("libs/lib-decoder-ffmpeg-release.aar")
    implementation files("libs/libmpv-release.aar")
`;
                config.modResults.contents = config.modResults.contents.replace(/dependencies\s*\{/, `dependencies {${aarDependencies}`);
            }
        }
        return config;
    });
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
