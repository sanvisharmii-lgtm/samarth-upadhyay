import { registerNode, loginNode, updateKeywords, fetchResults } from './api';
import { toggleAuthTabs, setWorkspaceView, renderSidebar, renderDataGrid } from './ui';

let sessionPin: string | null = null;
let userKeywords: string[] = [];
let currentKeyword: string | null = null;
let currentSearchTerm: string = ""; 

// Date Filter States
let currentDays: number | null = 30;
let customStartMs: number | null = null;
let customEndMs: number | null = null;

let activeSourcesData: [string, number][] = [];
let activeCitationsData: [string, number][] = [];
let activeOrganicData: [string, number][] = []; 

let sourcesLimit = 10;
let citationsLimit = 10;
let organicLimit = 10; 

// Track the actual number of successful searches per category
let sourcesSearchCount = 0;
let citationsSearchCount = 0;
let organicSearchCount = 0;

// --- UX Utility: Toast Notifications ---
const showToast = (message: string, type: 'error' | 'success' = 'error') => {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-sm font-medium transition-all transform translate-y-0 opacity-100 ${
    type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'
  }`;
  toast.innerText = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

const aggregateLinks = (entries: any[], type: string) => {
  const counts: Record<string, number> = {};
  entries.forEach(e => {
    try { JSON.parse(e[type] || '[]').forEach((l: string) => counts[l] = (counts[l] || 0) + 1); } catch {}
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};

const generateStrictPin = () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `${letters.charAt(Math.floor(Math.random() * 26))}${letters.charAt(Math.floor(Math.random() * 26))}${Math.floor(1000 + Math.random() * 9000)}`;
};

// --- Mobile Sidebar Helper ---
const closeMobileSidebar = () => {
  document.getElementById('workspace-sidebar')?.classList.remove('translate-x-0');
  document.getElementById('workspace-sidebar')?.classList.add('-translate-x-full');
  document.getElementById('sidebar-backdrop')?.classList.remove('block');
  document.getElementById('sidebar-backdrop')?.classList.add('hidden');
};

// Filter and Re-render logic updated to pass the exact search counts
const filterAndRender = () => {
  const filteredSources = activeSourcesData.filter(([url]) => url.toLowerCase().includes(currentSearchTerm));
  const filteredCitations = activeCitationsData.filter(([url]) => url.toLowerCase().includes(currentSearchTerm));
  const filteredOrganic = activeOrganicData.filter(([url]) => url.toLowerCase().includes(currentSearchTerm));

  // Passing the actual search counts instead of URL counts
  renderDataGrid('source-links-list', filteredSources, sourcesLimit, 'btn-more-sources', () => { sourcesLimit += 10; filterAndRender(); }, sourcesSearchCount);
  renderDataGrid('citation-links-list', filteredCitations, citationsLimit, 'btn-more-citations', () => { citationsLimit += 10; filterAndRender(); }, citationsSearchCount);
  renderDataGrid('organic-links-list', filteredOrganic, organicLimit, 'btn-more-organic', () => { organicLimit += 10; filterAndRender(); }, organicSearchCount);
};

const loadKeywordData = async (keyword: string) => {
  closeMobileSidebar(); // Close off-canvas menu on mobile when a query is selected
  
  currentKeyword = keyword;
  sourcesLimit = 10; citationsLimit = 10; organicLimit = 10;
  currentSearchTerm = ""; 
  
  const searchInput = document.getElementById('url-search') as HTMLInputElement;
  if (searchInput) searchInput.value = "";

  const loadingEl = document.getElementById('results-loading');
  const emptyEl = document.getElementById('results-empty');
  const contentEl = document.getElementById('results-content');

  emptyEl?.classList.add('hidden'); emptyEl?.classList.remove('flex');
  contentEl?.classList.add('hidden'); contentEl?.classList.remove('flex');
  loadingEl?.classList.remove('hidden'); loadingEl?.classList.add('flex');

  renderSidebar(userKeywords, currentKeyword, loadKeywordData);

  try {
    const data = await fetchResults(keyword, { days: currentDays, startDate: customStartMs, endDate: customEndMs });
    
    // Calculate how many database rows (searches) actually contained data for each category
    sourcesSearchCount = data.filter((row: any) => {
      try { return JSON.parse(row.source_links || '[]').length > 0; } catch { return false; }
    }).length;

    citationsSearchCount = data.filter((row: any) => {
      try { return JSON.parse(row.citation_links || '[]').length > 0; } catch { return false; }
    }).length;

    organicSearchCount = data.filter((row: any) => {
      try { return JSON.parse(row.organic_links || '[]').length > 0; } catch { return false; }
    }).length;

    activeSourcesData = aggregateLinks(data, 'source_links');
    activeCitationsData = aggregateLinks(data, 'citation_links');
    activeOrganicData = aggregateLinks(data, 'organic_links'); 

    const titleEl = document.getElementById('current-keyword-title');
    if (titleEl) titleEl.innerText = keyword;

    filterAndRender(); 

    loadingEl?.classList.add('hidden'); loadingEl?.classList.remove('flex');
    contentEl?.classList.remove('hidden'); contentEl?.classList.add('flex');
    
    if (emptyEl) emptyEl.innerHTML = `<p class="text-sm text-gray-500">Select a query from the sidebar to view metrics.</p>`;

  } catch (e) {
    loadingEl?.classList.add('hidden'); loadingEl?.classList.remove('flex');
    
    if (emptyEl) {
      emptyEl.innerHTML = `<p class="text-sm font-medium text-red-500">Failed to load data. Please try again or check your connection.</p>`;
      emptyEl.classList.remove('hidden'); 
      emptyEl.classList.add('flex');
    }
  }
};

// --- INITIALIZATION WRAPPER ---
// Bundling everything into a function allows Astro View Transitions to re-execute it on navigation
const initTrackerApp = async () => {
  
  // Prevent script from trying to attach listeners if not on the tracker page
  if (!document.getElementById('view-auth')) return;

  // --- Mobile Sidebar Event Listeners ---
  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
    document.getElementById('workspace-sidebar')?.classList.remove('-translate-x-full');
    document.getElementById('workspace-sidebar')?.classList.add('translate-x-0');
    document.getElementById('sidebar-backdrop')?.classList.remove('hidden');
    document.getElementById('sidebar-backdrop')?.classList.add('block');
  });
  
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);
  // --------------------------------------

  document.getElementById('url-search')?.addEventListener('input', (e) => {
    currentSearchTerm = (e.target as HTMLInputElement).value.toLowerCase();
    filterAndRender();
  });

  const dateFilter = document.getElementById('date-filter') as HTMLSelectElement;
  const customPicker = document.getElementById('custom-date-picker');
  
  dateFilter?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val === 'custom') {
      customPicker?.classList.remove('hidden'); customPicker?.classList.add('flex');
    } else {
      customPicker?.classList.add('hidden'); customPicker?.classList.remove('flex');
      currentDays = parseInt(val, 10);
      customStartMs = null; customEndMs = null;
      if (currentKeyword) loadKeywordData(currentKeyword);
    }
  });

  document.getElementById('btn-apply-dates')?.addEventListener('click', () => {
    const startStr = (document.getElementById('custom-start-date') as HTMLInputElement).value;
    const endStr = (document.getElementById('custom-end-date') as HTMLInputElement).value;
    if (startStr && endStr) {
      currentDays = null;
      customStartMs = new Date(`${startStr}T00:00:00`).getTime();
      customEndMs = new Date(`${endStr}T23:59:59`).getTime();
      if (currentKeyword) loadKeywordData(currentKeyword);
    } else {
      showToast("Please select both a start and end date.", "error");
    }
  });

  document.getElementById('btn-tab-login')?.addEventListener('click', () => toggleAuthTabs(true));
  document.getElementById('btn-tab-register')?.addEventListener('click', () => toggleAuthTabs(false));
  document.getElementById('btn-logout')?.addEventListener('click', () => { localStorage.removeItem('aio_pin'); window.location.reload(); });

  const modal = document.getElementById('keyword-modal');
  document.getElementById('btn-open-keywords')?.addEventListener('click', () => modal?.classList.remove('hidden'));
  document.getElementById('btn-close-keywords')?.addEventListener('click', () => modal?.classList.add('hidden'));
  document.getElementById('btn-cancel-keywords')?.addEventListener('click', () => modal?.classList.add('hidden'));

  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = (e.target as HTMLElement).querySelector('button');
    if (btn) {
      btn.innerHTML = `Generating...`; 
      btn.setAttribute('disabled', 'true');
    }
    
    const emailInput = document.getElementById('register-email') as HTMLInputElement;
    const email = emailInput ? emailInput.value : "";
    
    let pin = ""; let registered = false;
    try {
      while (!registered) {
        pin = generateStrictPin();
        const res = await registerNode(pin, email);
        if (res.ok) registered = true;
      }
      const pinDisplay = document.getElementById('generated-pin');
      if (pinDisplay) pinDisplay.innerText = pin;
      
      document.getElementById('register-ui')?.classList.add('hidden');
      document.getElementById('pin-panel')?.classList.replace('hidden', 'flex');
      
      const ackBtn = document.getElementById('btn-acknowledge-pin');
      if (ackBtn) {
        ackBtn.onclick = () => {
          sessionPin = pin; localStorage.setItem('aio_pin', pin);
          setWorkspaceView(pin); renderSidebar([], null, loadKeywordData);
        };
      }
    } catch {
      showToast("Registration failed. Please try again.", "error");
    } finally { 
      if (btn) {
        btn.innerHTML = `Create New Node`; 
        btn.removeAttribute('disabled'); 
      }
    }
  });

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = (e.target as HTMLElement).querySelector('button');
    const pinInput = document.getElementById('login-pin') as HTMLInputElement;
    const pin = pinInput ? pinInput.value.trim() : "";
    
    if (btn) {
      btn.innerText = "Authenticating...";
      btn.setAttribute('disabled', 'true');
    }

    try {
      const data = await loginNode(pin);
      sessionPin = pin; localStorage.setItem('aio_pin', pin);
      try { userKeywords = JSON.parse(data.keywords || "[]"); } catch {}
      
      const kwArea = document.getElementById('user-keywords') as HTMLTextAreaElement;
      if (kwArea) kwArea.value = userKeywords.join('\n');
      
      setWorkspaceView(pin); 
      if (userKeywords.length > 0) loadKeywordData(userKeywords[0]);
      else renderSidebar(userKeywords, null, loadKeywordData);
    } catch (e: any) { 
      showToast(e.message || "Login failed.", "error");
    } finally { 
      if (btn) {
        btn.innerText = "Next"; 
        btn.removeAttribute('disabled');
      }
    }
  });

  document.getElementById('keywords-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sessionPin) return;
    
    const btn = (e.target as HTMLElement).querySelector('button[type="submit"]');
    const rawData = (document.getElementById('user-keywords') as HTMLTextAreaElement).value;
    const keywords = rawData.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keywords.length > 15) {
      showToast("Maximum 15 queries allowed.", "error");
      return;
    }
    
    if (btn) {
      btn.innerHTML = `Saving...`;
      btn.setAttribute('disabled', 'true');
    }

    try {
      await updateKeywords(sessionPin, keywords);
      userKeywords = keywords;
      modal?.classList.add('hidden');
      showToast("Property configuration saved successfully.", "success");
      
      if (keywords.length > 0 && (!currentKeyword || !keywords.includes(currentKeyword))) loadKeywordData(keywords[0]);
      else renderSidebar(keywords, currentKeyword, loadKeywordData);
    } catch { 
      showToast("Failed to save changes. Check your connection.", "error"); 
    } finally { 
      if (btn) {
        btn.innerHTML = `Save Property`; 
        btn.removeAttribute('disabled');
      }
    }
  });

  // --- Session Restoration (Optimistic UI Fix) ---
  const savedPin = localStorage.getItem('aio_pin');
  if (savedPin) {
    sessionPin = savedPin;
    // Call UI function immediately to hide the login form
    setWorkspaceView(savedPin);
    
    try {
      const data = await loginNode(savedPin);
      try { userKeywords = JSON.parse(data.keywords || "[]"); } catch {}
      const kwArea = document.getElementById('user-keywords') as HTMLTextAreaElement;
      if (kwArea) kwArea.value = userKeywords.join('\n');
      
      if (userKeywords.length > 0) loadKeywordData(userKeywords[0]);
      else renderSidebar([], null, loadKeywordData);
    } catch (e: any) { 
      if (e.message && (e.message.includes('Invalid') || e.message.includes('Format'))) {
        localStorage.removeItem('aio_pin'); 
        window.location.reload(); // Hard reset if PIN is somehow invalid
      } else {
        showToast("Network issue restoring session. Please reload.", "error");
      }
    }
  }
};

// Replaces DOMContentLoaded. Listens for initial load AND Astro View Transitions.
document.addEventListener('astro:page-load', initTrackerApp);