const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to properly include local AAR dependencies.
 * 
 * Problem: Library modules (AAR) cannot contain other AAR dependencies.
 * Solution: Copy AARs to the main app module and inject gradle dependencies there.
 */
const withLocalAarDependencies = (config) => {
    // Step 1: Copy AAR files to android/app/libs
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const sourcePath = path.join(
                config.modRequest.projectRoot,
                'modules/crispy-native-core/android/libs'
            );
            const targetPath = path.join(
                config.modRequest.platformProjectRoot,
                'app/libs'
            );

            // Create target directory if it doesn't exist
            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }

            // Copy AAR files
            const aarFiles = ['libmpv-release.aar', 'lib-decoder-ffmpeg-release.aar'];
            for (const aarFile of aarFiles) {
                const sourceFile = path.join(sourcePath, aarFile);
                const targetFile = path.join(targetPath, aarFile);
                if (fs.existsSync(sourceFile)) {
                    fs.copyFileSync(sourceFile, targetFile);
                    console.log(`[withLocalAarDependencies] Copied ${aarFile} to app/libs/`);
                }
            }

            return config;
        },
    ]);

    // Step 2: Inject AAR dependencies into app build.gradle
    config = withAppBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            const aarDependencies = `
    // Include only FFmpeg decoder AAR to avoid duplicates with Maven Media3
    implementation files("libs/lib-decoder-ffmpeg-release.aar")
    
    // MPV Player library
    implementation files("libs/libmpv-release.aar")
`;
            // Only add if not already present
            if (!config.modResults.contents.includes('libmpv-release.aar')) {
                // Insert after the dependencies { line
                config.modResults.contents = config.modResults.contents.replace(
                    /dependencies\s*\{/,
                    `dependencies {${aarDependencies}`
                );
                console.log('[withLocalAarDependencies] Injected AAR dependencies into app/build.gradle');
            }
        }
        return config;
    });

    return config;
};

module.exports = withLocalAarDependencies;
