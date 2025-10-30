const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// 书签文件夹路径 - 使用相对路径
const BOOKMARKS_DIR = 'bookmarks';
// 模块化配置目录
const CONFIG_USER_DIR = 'config/user';
// 模块化页面配置目录
const CONFIG_USER_PAGES_DIR = path.join(CONFIG_USER_DIR, 'pages');
// 模块化输出配置文件路径
const MODULAR_OUTPUT_FILE = path.join(CONFIG_USER_PAGES_DIR, 'bookmarks.yml');
// 模块化默认书签配置文件路径
const MODULAR_DEFAULT_BOOKMARKS_FILE = 'config/_default/pages/bookmarks.yml';

// 图标映射，根据URL关键字匹配合适的图标
const ICON_MAPPING = {
  'github.com': 'fab fa-github',
  'stackoverflow.com': 'fab fa-stack-overflow',
  'youtube.com': 'fab fa-youtube',
  'twitter.com': 'fab fa-twitter',
  'facebook.com': 'fab fa-facebook',
  'instagram.com': 'fab fa-instagram',
  'linkedin.com': 'fab fa-linkedin',
  'reddit.com': 'fab fa-reddit',
  'amazon.com': 'fab fa-amazon',
  'google.com': 'fab fa-google',
  'gmail.com': 'fas fa-envelope',
  'drive.google.com': 'fab fa-google-drive',
  'docs.google.com': 'fas fa-file-alt',
  'medium.com': 'fab fa-medium',
  'dev.to': 'fab fa-dev',
  'gitlab.com': 'fab fa-gitlab',
  'bitbucket.org': 'fab fa-bitbucket',
  'wikipedia.org': 'fab fa-wikipedia-w',
  'discord.com': 'fab fa-discord',
  'slack.com': 'fab fa-slack',
  'apple.com': 'fab fa-apple',
  'microsoft.com': 'fab fa-microsoft',
  'android.com': 'fab fa-android',
  'twitch.tv': 'fab fa-twitch',
  'spotify.com': 'fab fa-spotify',
  'pinterest.com': 'fab fa-pinterest',
  'telegram.org': 'fab fa-telegram',
  'whatsapp.com': 'fab fa-whatsapp',
  'netflix.com': 'fas fa-film',
  'trello.com': 'fab fa-trello',
  'wordpress.com': 'fab fa-wordpress',
  'jira': 'fab fa-jira',
  'atlassian.com': 'fab fa-atlassian',
  'dropbox.com': 'fab fa-dropbox',
  'npm': 'fab fa-npm',
  'docker.com': 'fab fa-docker',
  'python.org': 'fab fa-python',
  'javascript': 'fab fa-js',
  'php.net': 'fab fa-php',
  'java': 'fab fa-java',
  'codepen.io': 'fab fa-codepen',
  'behance.net': 'fab fa-behance',
  'dribbble.com': 'fab fa-dribbble',
  'tumblr.com': 'fab fa-tumblr',
  'vimeo.com': 'fab fa-vimeo',
  'flickr.com': 'fab fa-flickr',
  'github.io': 'fab fa-github',
  'airbnb.com': 'fab fa-airbnb',
  'bitcoin': 'fab fa-bitcoin',
  'paypal.com': 'fab fa-paypal',
  'ethereum': 'fab fa-ethereum',
  'steam': 'fab fa-steam',
};

// 获取最新的书签文件
function getLatestBookmarkFile() {
  try {
    console.log('[DEBUG] 开始查找书签文件...');
    console.log('[DEBUG] 书签目录:', BOOKMARKS_DIR);
    
    // 确保书签目录存在
    if (!fs.existsSync(BOOKMARKS_DIR)) {
      console.log('[DEBUG] 书签目录不存在，创建目录...');
      fs.mkdirSync(BOOKMARKS_DIR, { recursive: true });
      console.log('[WARN] 书签目录为空，未找到HTML文件');
      return null;
    }

    // 获取目录中的所有HTML文件
    const files = fs.readdirSync(BOOKMARKS_DIR)
      .filter(file => file.toLowerCase().endsWith('.html'));

    console.log('[DEBUG] 找到的HTML文件数量:', files.length);
    if (files.length > 0) {
      console.log('[DEBUG] HTML文件列表:', files);
    }

    if (files.length === 0) {
      console.log('[WARN] 未找到任何HTML书签文件');
      return null;
    }

    // 获取文件状态，按最后修改时间排序
    const fileStats = files.map(file => ({
      file,
      mtime: fs.statSync(path.join(BOOKMARKS_DIR, file)).mtime
    }));

    // 找出最新的文件
    fileStats.sort((a, b) => b.mtime - a.mtime);
    const latestFile = fileStats[0].file;
    const latestFilePath = path.join(BOOKMARKS_DIR, latestFile);
    
    console.log('[INFO] 选择最新的书签文件:', latestFile);
    console.log('[DEBUG] 完整路径:', latestFilePath);
    
    return latestFilePath;
  } catch (error) {
    console.error('[ERROR] 查找书签文件时出错:', error);
    return null;
  }
}

// 解析书签HTML内容，支持2-4层级嵌套结构
function parseBookmarks(htmlContent) {
  console.log('[DEBUG] 开始解析书签HTML内容...');
  console.log('[DEBUG] HTML内容长度:', htmlContent.length, '字符');
  
  // 正则表达式匹配文件夹和书签
  const folderRegex = /<DT><H3([^>]*)>(.*?)<\/H3>/g;
  const bookmarkRegex = /<DT><A HREF="([^"]+)"[^>]*>(.*?)<\/A>/g;
  
  // 储存解析结果
  const bookmarks = {
    categories: []
  };
  
  // 递归解析嵌套文件夹
  function parseNestedFolder(htmlContent, parentPath = [], level = 1) {
    console.log(`[DEBUG] parseNestedFolder 被调用 - 层级:${level}, 路径:${parentPath.join('/')}, 内容长度:${htmlContent.length}`);
    
    const folders = [];
    let match;
    let matchCount = 0;
    
    // 创建新的正则表达式实例，避免全局正则的 lastIndex 问题
    const localFolderRegex = /<DT><H3([^>]*)>(.*?)<\/H3>/g;
    
    while ((match = localFolderRegex.exec(htmlContent)) !== null) {
      matchCount++;
      const folderName = match[2].trim();
      const folderStart = match.index;
      const folderEnd = match.index + match[0].length;
      
      console.log(`[DEBUG] 找到文件夹 #${matchCount}: "${folderName}" (层级${level}) 在位置 ${folderStart}`);
      
      // 查找文件夹的结束位置
      let folderContentEnd = htmlContent.length;
      let depth = 1;
      let pos = folderEnd;
      let loopCount = 0;
      const maxLoops = 10000; // 防止无限循环
      
      console.log(`[DEBUG] 开始查找文件夹"${folderName}"的边界，起始位置:${pos}`);
      
      while (pos < htmlContent.length && depth > 0) {
        loopCount++;
        if (loopCount > maxLoops) {
          console.error(`[ERROR] 检测到可能的无限循环! 文件夹:"${folderName}", 层级:${level}, 循环次数:${loopCount}`);
          console.error(`[ERROR] 当前位置:${pos}, 深度:${depth}`);
          console.error(`[ERROR] 周围内容:`, htmlContent.substring(pos, pos + 100));
          break;
        }
        
        // 修复：使用 search() 而不是 match()，因为 match() 返回数组没有 index 属性
        const remainingContent = htmlContent.substring(pos);
        const dlStartIndex = remainingContent.search(/<DL><p>/i);
        const dlEndIndex = remainingContent.search(/<\/DL><p>/i);
        
        if (loopCount % 100 === 0) {
          console.log(`[DEBUG] 循环 ${loopCount}: pos=${pos}, depth=${depth}, dlStart=${dlStartIndex}, dlEnd=${dlEndIndex}`);
        }
        
        // 找到开始标签且在结束标签之前（或没有结束标签）
        if (dlStartIndex !== -1 && (dlEndIndex === -1 || dlStartIndex < dlEndIndex)) {
          depth++;
          pos += dlStartIndex + '<DL><p>'.length;
          console.log(`[DEBUG] 找到 <DL><p> 在位置 ${pos}, depth增加到 ${depth}`);
        }
        // 找到结束标签
        else if (dlEndIndex !== -1) {
          depth--;
          pos += dlEndIndex + '</DL><p>'.length;
          console.log(`[DEBUG] 找到 </DL><p> 在位置 ${pos}, depth减少到 ${depth}`);
        }
        // 都没找到，退出循环
        else {
          console.log(`[DEBUG] 未找到更多标签，退出循环`);
          break;
        }
      }
      
      if (loopCount > 100) {
        console.log(`[DEBUG] 文件夹"${folderName}"边界查找循环${loopCount}次`);
      }
      
      folderContentEnd = pos;
      const folderContent = htmlContent.substring(folderEnd, folderContentEnd);
      
      console.log(`[DEBUG] 文件夹"${folderName}"内容长度: ${folderContent.length}`);
      
      // 解析文件夹内容
      const folder = {
        name: folderName,
        icon: 'fas fa-folder',
        path: [...parentPath, folderName]
      };
      
      // 检查是否包含子文件夹 - 创建新的正则实例避免干扰主循环
      const testFolderRegex = /<DT><H3([^>]*)>(.*?)<\/H3>/;
      const hasSubfolders = testFolderRegex.test(folderContent);
      
      console.log(`[DEBUG] 文件夹"${folderName}"包含子文件夹: ${hasSubfolders}`);
      
      if (hasSubfolders && level < 4) {
        console.log(`[DEBUG] 递归解析文件夹"${folderName}"的子文件夹...`);
        // 递归解析子文件夹
        const subfolders = parseNestedFolder(folderContent, folder.path, level + 1);
        
        console.log(`[DEBUG] 文件夹"${folderName}"解析到 ${subfolders.length} 个子项`);
        
        // 根据层级深度决定数据结构
        if (level === 1) {
          folder.subcategories = subfolders;
        } else if (level === 2) {
          folder.groups = subfolders;
        } else if (level === 3) {
          // 层级3直接解析书签
          folder.sites = parseSitesInFolder(folderContent);
        }
      } else {
        console.log(`[DEBUG] 解析文件夹"${folderName}"中的书签...`);
        // 解析书签
        folder.sites = parseSitesInFolder(folderContent);
      }
      
      // 只添加包含内容的文件夹
      const hasContent = folder.sites && folder.sites.length > 0 ||
                        folder.subcategories && folder.subcategories.length > 0 ||
                        folder.groups && folder.groups.length > 0;
      
      if (hasContent) {
        console.log(`[DEBUG] 添加文件夹"${folderName}" (包含内容)`);
        folders.push(folder);
      } else {
        console.log(`[DEBUG] 跳过空文件夹"${folderName}"`);
      }
    }
    
    console.log(`[DEBUG] parseNestedFolder 完成 - 层级:${level}, 返回 ${folders.length} 个文件夹`);
    return folders;
  }
  
  // 解析文件夹中的书签
  function parseSitesInFolder(folderContent) {
    const sites = [];
    let bookmarkMatch;
    let siteCount = 0;
    bookmarkRegex.lastIndex = 0;
    
    while ((bookmarkMatch = bookmarkRegex.exec(folderContent)) !== null) {
      siteCount++;
      const url = bookmarkMatch[1];
      const name = bookmarkMatch[2].trim();
      
      // 基于URL选择适当的图标
      let icon = 'fas fa-link'; // 默认图标
      for (const [keyword, iconClass] of Object.entries(ICON_MAPPING)) {
        if (url.includes(keyword)) {
          icon = iconClass;
          break;
        }
      }
      
      sites.push({
        name: name,
        url: url,
        icon: icon,
        description: ''
      });
    }
    
    console.log(`[DEBUG] parseSitesInFolder 完成 - 找到 ${siteCount} 个书签`);
    return sites;
  }
  
  // 开始解析
  console.log('[DEBUG] 开始递归解析顶层分类...');
  bookmarks.categories = parseNestedFolder(htmlContent);
  console.log(`[INFO] 解析完成 - 共找到 ${bookmarks.categories.length} 个顶层分类`);
  
  return bookmarks;
}

// 生成YAML配置
function generateBookmarksYaml(bookmarks) {
  try {
    // 创建书签页面配置
    const bookmarksPage = {
      title: '我的书签',
      subtitle: '从浏览器导入的书签收藏',
      categories: bookmarks.categories
    };
    
    // 转换为YAML
    const yamlString = yaml.dump(bookmarksPage, {
      indent: 2,
      lineWidth: -1,
      quotingType: '"'
    });
    
    // 添加注释
    const yamlWithComment = 
`# 自动生成的书签配置文件
# 由bookmark-processor.js生成于 ${new Date().toISOString()}
# 若要更新，请将新的书签HTML文件放入bookmarks/目录
# 此文件使用模块化配置格式，位于config/user/pages/目录下

${yamlString}`;
    
    return yamlWithComment;
  } catch (error) {
    console.error('Error generating YAML:', error);
    return null;
  }
}

// 更新导航以包含书签页面
function updateNavigationWithBookmarks() {
  // 模块化配置文件
  const modularUserNavFile = path.join(CONFIG_USER_DIR, 'navigation.yml');
  const modularDefaultNavFile = 'config/_default/navigation.yml';
  
  let navigationUpdated = false;
  
  // 按优先级顺序尝试更新导航配置
  
  // 1. 首选: 模块化用户导航配置
  if (fs.existsSync(modularUserNavFile)) {
    navigationUpdated = updateNavigationFile(modularUserNavFile);
  }
  // 2. 其次: 模块化默认导航配置
  else if (fs.existsSync(modularDefaultNavFile)) {
    // 如果用户导航文件不存在，我们需要先创建它，然后基于默认文件更新
    try {
      // 读取默认导航文件
      const defaultNavContent = fs.readFileSync(modularDefaultNavFile, 'utf8');
      const defaultNav = yaml.load(defaultNavContent);
      
      // 确保目录存在
      if (!fs.existsSync(CONFIG_USER_DIR)) {
        fs.mkdirSync(CONFIG_USER_DIR, { recursive: true });
      }
      
      // 写入用户导航文件
      fs.writeFileSync(modularUserNavFile, defaultNavContent, 'utf8');
      
      // 更新新创建的文件
      navigationUpdated = updateNavigationFile(modularUserNavFile);
    } catch (error) {
      console.error(`Error creating user navigation file:`, error);
    }
  }
}

// 更新单个导航配置文件
function updateNavigationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const navConfig = yaml.load(content);
    
    // 检查是否已有书签页面
    const hasBookmarksNav = Array.isArray(navConfig) && 
      navConfig.some(nav => nav.id === 'bookmarks');
    
    if (!hasBookmarksNav) {
      // 添加书签导航项
      if (!Array.isArray(navConfig)) {
        console.log(`Warning: Navigation config in ${filePath} is not an array, cannot update`);
        return false;
      }
      
      navConfig.push({
        name: '书签',
        icon: 'fas fa-bookmark',
        id: 'bookmarks',
        active: false
      });
      
      // 更新文件
      const updatedYaml = yaml.dump(navConfig, {
        indent: 2,
        lineWidth: -1,
        quotingType: '"'
      });
      
      fs.writeFileSync(filePath, updatedYaml, 'utf8');
      return true;
    }
    
    return false; // 无需更新
  } catch (error) {
    console.error(`Error updating navigation file ${filePath}:`, error);
    return false;
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('[INFO] 书签处理脚本启动');
  console.log('[INFO] 时间:', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  console.log('========================================\n');
  
  // 获取最新的书签文件
  console.log('[步骤 1/5] 查找书签文件...');
  const bookmarkFile = getLatestBookmarkFile();
  if (!bookmarkFile) {
    console.log('[ERROR] 未找到书签文件，处理终止');
    return;
  }
  console.log('[SUCCESS] ✓ 找到书签文件\n');
  
  try {
    // 读取文件内容
    console.log('[步骤 2/5] 读取书签文件...');
    const htmlContent = fs.readFileSync(bookmarkFile, 'utf8');
    console.log('[SUCCESS] ✓ 文件读取成功，大小:', htmlContent.length, '字符\n');
    
    // 解析书签
    console.log('[步骤 3/5] 解析书签结构...');
    const bookmarks = parseBookmarks(htmlContent);
    if (bookmarks.categories.length === 0) {
      console.error('[ERROR] HTML文件中未找到书签分类，处理终止');
      return;
    }
    console.log('[SUCCESS] ✓ 解析完成\n');
    
    // 生成YAML
    console.log('[步骤 4/5] 生成YAML配置...');
    const yamlContent = generateBookmarksYaml(bookmarks);
    if (!yamlContent) {
      console.error('[ERROR] YAML生成失败，处理终止');
      return;
    }
    console.log('[DEBUG] YAML内容长度:', yamlContent.length, '字符');
    console.log('[SUCCESS] ✓ YAML生成成功\n');
    
    // 保存文件
    console.log('[步骤 5/5] 保存配置文件...');
    try {
      // 确保目标目录存在
      if (!fs.existsSync(CONFIG_USER_PAGES_DIR)) {
        console.log('[DEBUG] 创建目录:', CONFIG_USER_PAGES_DIR);
        fs.mkdirSync(CONFIG_USER_PAGES_DIR, { recursive: true });
      }
      
      // 保存YAML到模块化位置
      console.log('[DEBUG] 写入文件:', MODULAR_OUTPUT_FILE);
      fs.writeFileSync(MODULAR_OUTPUT_FILE, yamlContent, 'utf8');
      
      // 验证文件是否确实被创建
      if (!fs.existsSync(MODULAR_OUTPUT_FILE)) {
        console.error(`[ERROR] 文件未能创建: ${MODULAR_OUTPUT_FILE}`);
        process.exit(1);
      }
      
      console.log('[SUCCESS] ✓ 文件保存成功');
      console.log('[INFO] 输出文件:', MODULAR_OUTPUT_FILE, '\n');
      
      // 更新导航
      console.log('[附加步骤] 更新导航配置...');
      updateNavigationWithBookmarks();
      console.log('[SUCCESS] ✓ 导航配置已更新\n');
      
    } catch (writeError) {
      console.error(`[ERROR] 写入文件时出错:`, writeError);
      console.error('[ERROR] 错误堆栈:', writeError.stack);
      process.exit(1);
    }
    
    console.log('========================================');
    console.log('[SUCCESS] ✓✓✓ 书签处理完成！✓✓✓');
    console.log('========================================');
    
  } catch (error) {
    console.error('[FATAL] 处理书签文件时发生错误:', error);
    console.error('[ERROR] 错误堆栈:', error.stack);
    process.exit(1);
  }
}

// 启动处理
if (require.main === module) {
  main().catch(err => {
    console.error('Unhandled error in bookmark processing:', err);
    process.exit(1);
  });
} 