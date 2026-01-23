const { withAppBuildGradle } = require('expo/config-plugins');

const withAndroidFixes = (config) => {
    return withAppBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents = addPackagingOptions(config.modResults.contents);
        }
        return config;
    });
};

function addPackagingOptions(buildGradle) {
    if (buildGradle.includes("pickFirst 'lib/**/libc++_shared.so'")) {
        return buildGradle;
    }

    // Add packagingOptions to pick the first libc++_shared.so found
    // This resolves conflicts when multiple libraries (like Reanimated, Hermes, MPV)
    // bundle their own version of the standard library.
    const packagingOptions = `
    packagingOptions {
        jniLibs {
            useLegacyPackaging (findProperty('expo.useLegacyPackaging') ?: 'false').toBoolean()
            pickFirst 'lib/**/libc++_shared.so'
        }
    }
`;

    if (buildGradle.includes('packagingOptions {')) {
        // If it already exists, inject the pickFirst rule
        return buildGradle.replace(
            /packagingOptions\s*\{\s*jniLibs\s*\{/,
            `packagingOptions {
        jniLibs {
            pickFirst 'lib/**/libc++_shared.so'`
        );
    } else {
        // If not, add it to the android block
        return buildGradle.replace(
            /android\s*\{/,
            `android {
${packagingOptions}`
        );
    }
}

module.exports = withAndroidFixes;
