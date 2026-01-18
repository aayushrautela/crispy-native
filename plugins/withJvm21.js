const { withProjectBuildGradle } = require('@expo/config-plugins');

const withJvm21 = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = config.modResults.contents + `
      
// Force JVM 21 for all subprojects to resolve compatibility issues
allprojects {
    afterEvaluate {
        if (project.hasProperty("android")) {
            android {
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
}
`;
    }
    return config;
  });
};

module.exports = withJvm21;
