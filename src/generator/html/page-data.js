const fs = require('fs');
const path = require('path');
const { getSubmenuForNavItem, assignCategorySlugs } = require('../config');
const {
  tryLoadArticlesFeedCache,
  buildArticlesCategoriesByPageCategories,
} = require('../cache/articles');
const {
  tryLoadProjectsRepoCache,
  applyRepoMetaToCategories,
  buildProjectsMeta,
} = require('../cache/projects');
const { getPageConfigUpdatedAtMeta } = require('../utils/pageMeta');
const { createLogger, isVerbose } = require('../utils/logger');

const log = createLogger('render');

function prepareNavigationData(pageId, config) {
  if (!Array.isArray(config.navigation)) {
    log.warn('config.navigation 不是数组，已降级为空数组');
    return [];
  }

  return config.navigation.map((nav) => {
    const navItem = {
      ...nav,
      isActive: nav.id === pageId,
      active: nav.id === pageId,
    };

    const submenu = getSubmenuForNavItem(navItem, config);
    if (submenu) {
      navItem.submenu = submenu;
    }

    return navItem;
  });
}

function resolveTemplateName(pageId, data) {
  const explicitTemplate = typeof data.template === 'string' ? data.template.trim() : '';
  let templateName = explicitTemplate || pageId;

  if (!explicitTemplate) {
    const inferredTemplatePath = path.join(
      process.cwd(),
      'templates',
      'pages',
      `${templateName}.hbs`
    );
    if (!fs.existsSync(inferredTemplatePath)) {
      templateName = 'page';
    }
  }

  return templateName;
}

function applyProjectsData(data, pageId, config) {
  data.siteCardStyle = 'repo';
  data.projectsMeta = buildProjectsMeta(config);
  if (Array.isArray(data.categories)) {
    const repoCache = tryLoadProjectsRepoCache(pageId, config);
    if (repoCache && repoCache.map) {
      applyRepoMetaToCategories(data.categories, repoCache.map);
    }
  }
}

function applyArticlesData(data, pageId, config) {
  const cache = tryLoadArticlesFeedCache(pageId, config);
  data.articlesItems = cache && Array.isArray(cache.items) ? cache.items : [];
  data.articlesMeta = cache ? cache.meta : null;
  data.articlesCategories = data.articlesItems.length
    ? buildArticlesCategoriesByPageCategories(data.categories, data.articlesItems)
    : [];
}

function applyBookmarksData(data, pageId) {
  const updatedAtMeta = getPageConfigUpdatedAtMeta(pageId);
  if (updatedAtMeta) {
    data.pageMeta = { ...updatedAtMeta };
  }
}

function convertTopLevelSitesToCategory(data, pageId, templateName) {
  const isFriendsPage = pageId === 'friends' || templateName === 'friends';
  const isArticlesPage = pageId === 'articles' || templateName === 'articles';

  if (
    (isFriendsPage || isArticlesPage) &&
    (!Array.isArray(data.categories) || data.categories.length === 0) &&
    Array.isArray(data.sites) &&
    data.sites.length > 0
  ) {
    const implicitName = isFriendsPage ? '全部友链' : '全部来源';
    data.categories = [
      {
        name: implicitName,
        icon: 'fas fa-link',
        sites: data.sites,
      },
    ];
  }
}

function applyHomePageTitles(data, pageId, config) {
  const homePageId =
    config.homePageId ||
    (Array.isArray(config.navigation) && config.navigation[0] ? config.navigation[0].id : null) ||
    'home';

  data.homePageId = homePageId;

  if (pageId === homePageId && config.profile) {
    if (config.profile.title !== undefined) data.title = config.profile.title;
    if (config.profile.subtitle !== undefined) data.subtitle = config.profile.subtitle;
  }
}

function preparePageData(pageId, config) {
  const data = {
    ...(config || {}),
    currentPage: pageId,
    pageId,
  };

  data.navigation = prepareNavigationData(pageId, config);
  data.socialLinks = Array.isArray(config.social) ? config.social : [];
  data.navigationData = data.navigation;

  if (config[pageId]) {
    Object.assign(data, config[pageId]);
  }

  if (data.title === undefined) {
    const navItem = Array.isArray(config.navigation)
      ? config.navigation.find((nav) => nav.id === pageId)
      : null;
    if (navItem && navItem.name !== undefined) data.title = navItem.name;
  }
  if (data.subtitle === undefined) data.subtitle = '';
  if (!Array.isArray(data.categories)) data.categories = [];

  const templateName = resolveTemplateName(pageId, data);

  if (templateName === 'projects') {
    applyProjectsData(data, pageId, config);
  }

  convertTopLevelSitesToCategory(data, pageId, templateName);

  if (templateName === 'articles') {
    applyArticlesData(data, pageId, config);
  }

  if (templateName === 'bookmarks') {
    applyBookmarksData(data, pageId);
  }

  applyHomePageTitles(data, pageId, config);

  if (Array.isArray(data.categories) && data.categories.length > 0) {
    assignCategorySlugs(data.categories, new Map());
  }

  if (config[pageId] && config[pageId].template) {
    if (isVerbose()) log.info(`页面 ${pageId} 使用指定模板`, { template: templateName });
  }

  return { data, templateName };
}

module.exports = {
  preparePageData,
};
