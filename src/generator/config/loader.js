const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

function handleConfigLoadError(filePath, error) {
  console.error(`Error loading configuration from ${filePath}:`, error);
}

function safeLoadYamlConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const docs = yaml.loadAll(fileContent);

    if (docs.length === 1) {
      return docs[0];
    }

    if (docs.length > 1) {
      console.warn(
        `Warning: Multiple documents found in ${filePath}. Using the first document only.`
      );
      return docs[0];
    }

    return null;
  } catch (error) {
    handleConfigLoadError(filePath, error);
    return null;
  }
}

function loadModularConfig(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const config = {
    site: {},
    navigation: [],
    fonts: {},
    profile: {},
    social: [],
    categories: [],
  };

  const siteConfigPath = path.join(dirPath, 'site.yml');
  const siteConfig = safeLoadYamlConfig(siteConfigPath);
  if (siteConfig) {
    config.site = siteConfig;

    if (siteConfig.fonts) config.fonts = siteConfig.fonts;
    if (siteConfig.profile) config.profile = siteConfig.profile;
    if (siteConfig.social) config.social = siteConfig.social;
    if (siteConfig.icons) config.icons = siteConfig.icons;

    if (siteConfig.navigation) {
      config.navigation = siteConfig.navigation;
      console.log('使用 site.yml 中的导航配置');
    }
  }

  const pagesPath = path.join(dirPath, 'pages');
  if (fs.existsSync(pagesPath)) {
    const files = fs
      .readdirSync(pagesPath)
      .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));

    files.forEach((file) => {
      const filePath = path.join(pagesPath, file);
      const fileConfig = safeLoadYamlConfig(filePath);

      if (fileConfig) {
        const configKey = path.basename(file, path.extname(file));
        config[configKey] = fileConfig;
      }
    });
  }

  return config;
}

module.exports = {
  safeLoadYamlConfig,
  loadModularConfig,
};
