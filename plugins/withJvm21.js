const { withProjectBuildGradle } = require('@expo/config-plugins');

const withJvm21 = (config) => {
    return withProjectBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents = config.modResults.contents + `
      
// Force JVM 21 for all subprojects to resolve compatibility issues
subprojects { project ->
    def configureAndroid = {
        if (project.hasProperty("android")) {
            project.android {
                compileOptions {
                    sourceCompatibility JavaVersion.VERSION_21
                    targetCompatibility JavaVersion.VERSION_21
                }
                kotlinOptions {
                    jvmTarget = "21"
                }
            }
        }
    }

    if (project.state.executed) {
        configureAndroid()
    } else {
        project.afterEvaluate {
            configureAndroid()
        }
    }
}
`;
        }
        return config;
    });
};

module.exports = withJvm21;
