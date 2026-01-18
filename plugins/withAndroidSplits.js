const { withAppBuildGradle } = require('@expo/config-plugins');

const withAndroidSplits = (config) => {
    return withAppBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            const splitsBlock = `
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a', 'x86_64'
            universalApk true
        }
    }

    // Generate unique version codes for each split APK
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
            if (!config.modResults.contents.includes('splits {')) {
                config.modResults.contents = config.modResults.contents.replace(
                    /android {/,
                    `android {${splitsBlock}`
                );
            }
        }
        return config;
    });
};

module.exports = withAndroidSplits;
