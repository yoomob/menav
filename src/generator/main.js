// 生成端主实现（由 src/generator.js 薄入口加载并 re-export）
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { loadHandlebarsTemplates, getDefaultLayoutTemplate, renderTemplate } = require('./template/engine');
const { MENAV_EXTENSION_CONFIG_FILE, loadConfig, getSubmenuForNavItem } = require('./config');

const { generateNavigation, generateCategories, generateSocialLinks } = require('./html/components');
const { generate404Html } = require('./html/404');
const { generateFontLinks, generateFontCss } = require('./html/fonts');
const { preparePageData } = require('./html/page-data');
const { collectSitesRecursively } = require('./utils/sites');

/**
 * 渲染单个页面
 * @param {string} pageId 页面ID
 * @param {Object} config 配置数据
 * @returns {string} 渲染后的HTML
 */
function renderPage(pageId, config) {
  const { data, templateName } = preparePageData(pageId, config);
  return renderTemplate(templateName, data, false);
}

/**
 * 生成所有页面的HTML内容
 * @param {Object} config 配置对象
 * @returns {Object} 包含所有页面HTML的对象
 */
function generateAllPagesHTML(config) {
  // 页面内容集合
  const pages = {};

  // 渲染配置中定义的所有页面
  if (Array.isArray(config.navigation)) {
    config.navigation.forEach((navItem) => {
      const pageId = navItem.id;

      // 渲染页面内容
      pages[pageId] = renderPage(pageId, config);
    });
  }

  // 确保搜索结果页存在
  if (!pages['search-results']) {
    pages['search-results'] = renderPage('search-results', config);
  }

  return pages;
}

/**
 * 生成完整的HTML
 * @param {Object} config 配置对象
 * @returns {string} 完整HTML
 */
function generateHTML(config) {
  // 获取所有页面内容
  const pages = generateAllPagesHTML(config);

  // 获取当前年份
  const currentYear = new Date().getFullYear();

  // 准备导航数据，添加 submenu 字段
  const navigationData = config.navigation.map((nav) => {
    const navItem = { ...nav };

    // 使用辅助函数获取子菜单
    const submenu = getSubmenuForNavItem(navItem, config);
    if (submenu) {
      navItem.submenu = submenu;
    }

    return navItem;
  });

  // 准备字体链接与 CSS 变量
  const fontLinks = generateFontLinks(config);
  const fontCss = generateFontCss(config);

  // 准备社交链接
  const socialLinks = generateSocialLinks(config.social);

  // 使用主布局模板
  const layoutData = {
    ...config,
    pages,
    fontLinks,
    fontCss,
    navigationData,
    currentYear,
    socialLinks,
    navigation: generateNavigation(config.navigation, config), // 兼容旧版
    social: Array.isArray(config.social) ? config.social : [], // 兼容旧版

    // 确保配置数据可用于浏览器扩展
    configJSON: config.configJSON, // 从 prepareRenderData 函数中获取的配置数据
  };

  try {
    // 使用辅助函数获取默认布局模板
    const { template: layoutTemplate } = getDefaultLayoutTemplate();

    // 渲染模板
    return layoutTemplate(layoutData);
  } catch (error) {
    console.error('Error rendering main HTML template:', error);
    throw error;
  }
}

function tryMinifyStaticAsset(srcPath, destPath, loader) {
  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch {
    return false;
  }

  try {
    const source = fs.readFileSync(srcPath, 'utf8');
    const result = esbuild.transformSync(source, {
      loader,
      minify: true,
      charset: 'utf8',
    });
    fs.writeFileSync(destPath, result.code);
    return true;
  } catch (error) {
    console.error(`Error minifying ${srcPath}:`, error);
    return false;
  }
}

// 复制静态文件
function copyStaticFiles(config) {
  // 确保 dist 目录存在
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // 复制 CSS 文件
  try {
    if (!tryMinifyStaticAsset('assets/style.css', 'dist/style.css', 'css')) {
      fs.copyFileSync('assets/style.css', 'dist/style.css');
    }
  } catch (e) {
    console.error('Error copying style.css:', e);
  }

  try {
    if (!tryMinifyStaticAsset('assets/pinyin-match.js', 'dist/pinyin-match.js', 'js')) {
      fs.copyFileSync('assets/pinyin-match.js', 'dist/pinyin-match.js');
    }
  } catch (e) {
    console.error('Error copying pinyin-match.js:', e);
  }

  // dist/script.js 由构建阶段 runtime bundle 产出（scripts/build-runtime.js），这里不再复制/覆盖

  // faviconUrl（站点级自定义图标）：若使用本地路径（建议以 assets/ 开头），则复制到 dist 下同路径
  try {
    const copied = new Set();

    const copyLocalAsset = (rawUrl) => {
      const raw = String(rawUrl || '').trim();
      if (!raw) return;
      if (/^https?:\/\//i.test(raw)) return;

      const rel = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
      if (!rel.startsWith('assets/')) return;

      const normalized = path.posix.normalize(rel);
      if (!normalized.startsWith('assets/')) return;
      if (copied.has(normalized)) return;
      copied.add(normalized);

      const srcPath = path.join(process.cwd(), normalized);
      const destPath = path.join(process.cwd(), 'dist', normalized);
      if (!fs.existsSync(srcPath)) {
        console.warn(`[WARN] faviconUrl 本地文件不存在：${normalized}`);
        return;
      }

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    };

    if (config && Array.isArray(config.navigation)) {
      config.navigation.forEach((navItem) => {
        const pageId = navItem && navItem.id ? String(navItem.id) : '';
        if (!pageId) return;
        const pageConfig = config[pageId];
        if (!pageConfig || typeof pageConfig !== 'object') return;

        if (Array.isArray(pageConfig.sites)) {
          pageConfig.sites.forEach((site) => {
            if (!site || typeof site !== 'object') return;
            copyLocalAsset(site.faviconUrl);
          });
        }

        if (Array.isArray(pageConfig.categories)) {
          const sites = [];
          pageConfig.categories.forEach((category) => collectSitesRecursively(category, sites));
          sites.forEach((site) => {
            if (!site || typeof site !== 'object') return;
            copyLocalAsset(site.faviconUrl);
          });
        }
      });
    }
  } catch (e) {
    console.error('Error copying faviconUrl assets:', e);
  }

  // 如果配置了 favicon，确保文件存在并复制
  if (config.site.favicon) {
    try {
      if (fs.existsSync(`assets/${config.site.favicon}`)) {
        fs.copyFileSync(`assets/${config.site.favicon}`, `dist/${path.basename(config.site.favicon)}`);
      } else if (fs.existsSync(config.site.favicon)) {
        fs.copyFileSync(config.site.favicon, `dist/${path.basename(config.site.favicon)}`);
      } else {
        console.warn(`Warning: Favicon file not found: ${config.site.favicon}`);
      }
    } catch (e) {
      console.error('Error copying favicon:', e);
    }
  }
}

// 主函数
function main() {
  const config = loadConfig();

  try {
    // 确保 dist 目录存在
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }

    // 初始化 Handlebars 模板系统
    loadHandlebarsTemplates();

    // 使用 generateHTML 函数生成完整的 HTML
    const htmlContent = generateHTML(config);

    // 生成 HTML
    fs.writeFileSync('dist/index.html', htmlContent);

    // 扩展专用配置：独立静态文件（按需加载）
    try {
      const extensionConfig =
        config && config.extensionConfig ? JSON.stringify(config.extensionConfig, null, 2) : '';
      if (extensionConfig) {
        fs.writeFileSync(path.join('dist', MENAV_EXTENSION_CONFIG_FILE), extensionConfig);
      }
    } catch (error) {
      console.error('Error writing extension config file:', error);
    }

    // GitHub Pages 静态路由回退：用于支持 /<id> 形式的路径深链接
    fs.writeFileSync('dist/404.html', generate404Html(config));

    // 构建运行时脚本（bundle → dist/script.js）
    try {
      execFileSync(process.execPath, [path.join(process.cwd(), 'scripts', 'build-runtime.js')], {
        stdio: 'inherit',
      });
    } catch (error) {
      console.error('Error bundling runtime script:', error);
      process.exit(1);
    }

    // 复制静态文件
    copyStaticFiles(config);
  } catch (e) {
    console.error('Error in main function:', e);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

// 导出供测试使用的函数
module.exports = {
  main,
  loadConfig,
  generateHTML,
  generate404Html,
  copyStaticFiles,
  generateNavigation,
  generateCategories,
  loadHandlebarsTemplates,
  renderTemplate,
  generateAllPagesHTML,
};
