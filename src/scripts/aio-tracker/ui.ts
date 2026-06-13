export function toggleAuthTabs(showLogin: boolean) {
  const loginForm = document.getElementById('form-login-container');
  const registerForm = document.getElementById('form-register-container');
  const tabLogin = document.getElementById('btn-tab-login');
  const tabRegister = document.getElementById('btn-tab-register');

  const activeTabClass = "flex-1 pb-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 transition-all";
  const inactiveTabClass = "flex-1 pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-all";

  if (showLogin) {
    registerForm?.classList.add('hidden'); registerForm?.classList.remove('flex');
    loginForm?.classList.remove('hidden'); loginForm?.classList.add('flex');
    if (tabLogin) tabLogin.className = activeTabClass;
    if (tabRegister) tabRegister.className = inactiveTabClass;
  } else {
    loginForm?.classList.add('hidden'); loginForm?.classList.remove('flex');
    registerForm?.classList.remove('hidden'); registerForm?.classList.add('flex');
    if (tabRegister) tabRegister.className = activeTabClass;
    if (tabLogin) tabLogin.className = inactiveTabClass;
  }
}

export function setWorkspaceView(pin: string) {
  const auth = document.getElementById('view-auth');
  const ws = document.getElementById('view-workspace');

  auth?.classList.add('hidden'); auth?.classList.remove('flex');
  ws?.classList.remove('hidden'); ws?.classList.add('flex');
  document.getElementById('btn-logout')?.classList.remove('hidden');
  
  const badge = document.getElementById('auth-status-badge');
  if (badge) badge.innerHTML = `<div class="w-2 h-2 rounded-full bg-green-500"></div> Connected: ${pin}`;
}

export function renderSidebar(keywords: string[], activeKeyword: string | null, onSelect: (kw: string) => void) {
  const list = document.getElementById('sidebar-keyword-list');
  if (!list) return;

  if (keywords.length === 0) {
    list.innerHTML = `<li class="text-xs text-gray-500 px-4 py-4 text-center">No queries configured.</li>`;
    return;
  }

  list.innerHTML = '';
  keywords.forEach(kw => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    const isActive = kw === activeKeyword;
    
    btn.className = `w-full text-left px-4 py-3 text-sm transition-colors truncate border-l-4 ${
      isActive 
        ? 'bg-[#F0F4F8] dark:bg-[#232429] border-blue-600 text-blue-700 dark:text-blue-400 font-medium' 
        : 'border-transparent text-gray-600 dark:text-gray-300 hover:bg-[#F8F9FA] dark:hover:bg-[#1a1b1f]'
    }`;
    btn.textContent = kw;
    btn.onclick = () => onSelect(kw);
    
    li.appendChild(btn);
    list.appendChild(li);
  });
}

export function renderDataGrid(
  listId: string, 
  data: [string, number][], 
  limit: number, 
  btnId: string, 
  onMore: () => void,
  totalResultsCount: number
) {
  const container = document.getElementById(listId);
  const btn = document.getElementById(btnId);
  const headerInfo = document.getElementById(`${listId}-header`);
  
  if (!container || !btn) return;

  if (headerInfo) {
    headerInfo.innerText = `Results from ${totalResultsCount} searches`;
  }

  container.innerHTML = ''; // Clear container for fresh render

  if (data.length === 0) {
    container.innerHTML = `<li class="px-5 py-6 text-sm text-gray-500 border-b border-gray-100 dark:border-gray-800 text-center">No events logged.</li>`;
    btn.classList.add('hidden'); btn.classList.remove('block');
    return;
  }

  const maxCount = data[0][1];
  const isSourceList = listId === 'source-links-list';
  const isOrganicList = listId === 'organic-links-list';

  container.innerHTML = data.slice(0, limit).map(([linkStr, count], i) => {
    const pct = Math.max(1, (count / maxCount) * 100);
    
    let url = linkStr;
    let title = linkStr;

    if (linkStr.includes(' : ')) {
      const parts = linkStr.split(' : ');
      title = parts[0].trim();
      url = parts[1].trim();
    }

    if (!isSourceList && !isOrganicList) {
      try {
        const u = new URL(url);
        const domain = u.hostname.replace('www.', '');
        const pathParts = u.pathname.split('/').filter(Boolean);
        if (title === url) {
          title = pathParts.length > 0 ? pathParts[pathParts.length - 1].replace(/[-_]/g, ' ') : domain;
          title = title.charAt(0).toUpperCase() + title.slice(1);
        }
      } catch(e) {}
    }

    // Organic List gets Orange color
    const linkColorClass = isOrganicList 
      ? "text-orange-600 dark:text-orange-400" 
      : "text-[#1a0dab] dark:text-[#8ab4f8]";

    let linkContent = isSourceList 
      ? `<div class="flex flex-col overflow-hidden w-full pt-0.5">
           <a href="${url}" target="_blank" class="text-sm font-medium ${linkColorClass} hover:underline truncate">${url}</a>
         </div>`
      : `<div class="flex flex-col overflow-hidden w-full">
           <a href="${url}" target="_blank" class="text-base font-medium ${linkColorClass} hover:underline truncate mb-0.5">${title}</a>
           <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-sans">
             <span class="truncate max-w-full">${url}</span>
           </div>
         </div>`;

    return `
      <li class="relative group flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800/50 hover:bg-[#F8F9FA] dark:hover:bg-[#232429] transition-colors">
        <div class="absolute left-0 bottom-0 top-0 bg-[#E8F0FE] dark:bg-blue-900/10 -z-10" style="width: ${pct}%"></div>
        <div class="flex items-start gap-4 overflow-hidden pr-4 w-full relative z-10">
           <span class="text-xs text-gray-400 w-4 text-right pt-1 shrink-0">${i + 1}.</span>
           ${linkContent}
        </div>
        <div class="flex flex-col items-end shrink-0 z-10 pl-4 pt-1">
           <span class="text-sm font-medium text-gray-900 dark:text-gray-100">${count}</span>
        </div>
      </li>
    `;
  }).join('');

  if (data.length > limit) {
    btn.classList.remove('hidden'); btn.classList.add('block');
    btn.onclick = onMore;
  } else {
    btn.classList.add('hidden'); btn.classList.remove('block');
  }
}