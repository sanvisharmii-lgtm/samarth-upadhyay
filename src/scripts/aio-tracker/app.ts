import { registerNode, loginNode, updateKeywords, fetchResults } from './api';
import { toggleAuthTabs, setWorkspaceView, renderSidebar, renderDataGrid } from './ui';

let sessionPin: string | null = null;
let userKeywords: string[] = [];
let currentKeyword: string | null = null;
let currentSearchTerm: string = ""; // Track URL search filter

// Date Filter States
let currentDays: number | null = 30;
let customStartMs: number | null = null;
let customEndMs: number | null = null;

let activeSourcesData: [string, number][] = [];
let activeCitationsData: [string, number][] = [];
let activeOrganicData: [string, number][] = []; // New: Organic Data State

let sourcesLimit = 10;
let citationsLimit = 10;
let organicLimit = 10; // New: Limit for Organic

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

// Filter and Re-render logic updated for Organic Data
const filterAndRender = () => {
  const filteredSources = activeSourcesData.filter(([url]) => url.toLowerCase().includes(currentSearchTerm));
  const filteredCitations = activeCitationsData.filter(([url]) => url.toLowerCase().includes(currentSearchTerm));
  const filteredOrganic = activeOrganicData.filter(([url]) => url.toLowerCase().includes(currentSearchTerm));

  renderDataGrid('source-links-list', filteredSources, sourcesLimit, 'btn-more-sources', () => { sourcesLimit += 10; filterAndRender(); }, filteredSources.length);
  renderDataGrid('citation-links-list', filteredCitations, citationsLimit, 'btn-more-citations', () => { citationsLimit += 10; filterAndRender(); }, filteredCitations.length);
  renderDataGrid('organic-links-list', filteredOrganic, organicLimit, 'btn-more-organic', () => { organicLimit += 10; filterAndRender(); }, filteredOrganic.length);
};

const loadKeywordData = async (keyword: string) => {
  currentKeyword = keyword;
  sourcesLimit = 10; citationsLimit = 10; organicLimit = 10;
  currentSearchTerm = ""; // Reset filter on new keyword
  (document.getElementById('url-search') as HTMLInputElement).value = "";

  const loadingEl = document.getElementById('results-loading');
  const emptyEl = document.getElementById('results-empty');
  const contentEl = document.getElementById('results-content');

  emptyEl?.classList.add('hidden'); emptyEl?.classList.remove('flex');
  contentEl?.classList.add('hidden'); contentEl?.classList.remove('flex');
  loadingEl?.classList.remove('hidden'); loadingEl?.classList.add('flex');

  renderSidebar(userKeywords, currentKeyword, loadKeywordData);

  try {
    const data = await fetchResults(keyword, { days: currentDays, startDate: customStartMs, endDate: customEndMs });
    activeSourcesData = aggregateLinks(data, 'source_links');
    activeCitationsData = aggregateLinks(data, 'citation_links');
    activeOrganicData = aggregateLinks(data, 'organic_links'); // Process Organic Data

    const titleEl = document.getElementById('current-keyword-title');
    if (titleEl) titleEl.innerText = keyword;

    filterAndRender(); 

    loadingEl?.classList.add('hidden'); loadingEl?.classList.remove('flex');
    contentEl?.classList.remove('hidden'); contentEl?.classList.add('flex');
  } catch (e) {
    loadingEl?.classList.add('hidden'); loadingEl?.classList.remove('flex');
    emptyEl?.classList.remove('hidden'); emptyEl?.classList.add('flex');
  }
};

window.addEventListener('DOMContentLoaded', async () => {
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
      alert("Please select both a start and end date.");
    }
  });

  const savedPin = localStorage.getItem('aio_pin');
  if (savedPin) {
    try {
      const data = await loginNode(savedPin);
      sessionPin = savedPin;
      try { userKeywords = JSON.parse(data.keywords || "[]"); } catch {}
      (document.getElementById('user-keywords') as HTMLTextAreaElement).value = userKeywords.join('\n');
      setWorkspaceView(savedPin);
      if (userKeywords.length > 0) loadKeywordData(userKeywords[0]);
      else renderSidebar([], null, loadKeywordData);
    } catch { localStorage.removeItem('aio_pin'); }
  }

  document.getElementById('btn-tab-login')?.addEventListener('click', () => toggleAuthTabs(true));
  document.getElementById('btn-tab-register')?.addEventListener('click', () => toggleAuthTabs(false));
  document.getElementById('btn-logout')?.addEventListener('click', () => { localStorage.removeItem('aio_pin'); window.location.reload(); });

  const modal = document.getElementById('keyword-modal');
  document.getElementById('btn-open-keywords')?.addEventListener('click', () => modal?.classList.remove('hidden'));
  document.getElementById('btn-close-keywords')?.addEventListener('click', () => modal?.classList.add('hidden'));
  document.getElementById('btn-cancel-keywords')?.addEventListener('click', () => modal?.classList.add('hidden'));

  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const email = (document.getElementById('register-email') as HTMLInputElement).value;
    btn.innerHTML = `Generating...`; btn.setAttribute('disabled', 'true');
    let pin = ""; let registered = false;
    try {
      while (!registered) {
        pin = generateStrictPin();
        const res = await registerNode(pin, email);
        if (res.ok) registered = true;
      }
      document.getElementById('generated-pin')!.innerText = pin;
      document.getElementById('register-ui')?.classList.add('hidden');
      document.getElementById('pin-panel')?.classList.replace('hidden', 'flex');
      document.getElementById('btn-acknowledge-pin')?.addEventListener('click', () => {
        sessionPin = pin; localStorage.setItem('aio_pin', pin);
        setWorkspaceView(pin); renderSidebar([], null, loadKeywordData);
      });
    } finally { btn.innerHTML = `Create New Node`; btn.removeAttribute('disabled'); }
  });

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const pin = (document.getElementById('login-pin') as HTMLInputElement).value.toUpperCase();
    btn.innerText = "Authenticating...";
    try {
      const data = await loginNode(pin);
      sessionPin = pin; localStorage.setItem('aio_pin', pin);
      try { userKeywords = JSON.parse(data.keywords || "[]"); } catch {}
      (document.getElementById('user-keywords') as HTMLTextAreaElement).value = userKeywords.join('\n');
      setWorkspaceView(pin); 
      if (userKeywords.length > 0) loadKeywordData(userKeywords[0]);
      else renderSidebar(userKeywords, null, loadKeywordData);
    } catch (e: any) { alert(e.message); } 
    finally { btn.innerText = "Next"; }
  });

  document.getElementById('keywords-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sessionPin) return;
    const btn = e.target.querySelector('button[type="submit"]');
    const rawData = (document.getElementById('user-keywords') as HTMLTextAreaElement).value;
    const keywords = rawData.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keywords.length > 15) return alert("Maximum 15 queries allowed.");
    btn.innerHTML = `Saving...`;
    try {
      await updateKeywords(sessionPin, keywords);
      userKeywords = keywords;
      modal?.classList.add('hidden');
      if (keywords.length > 0 && (!currentKeyword || !keywords.includes(currentKeyword))) loadKeywordData(keywords[0]);
      else renderSidebar(keywords, currentKeyword, loadKeywordData);
    } catch { alert("Failed to save."); } 
    finally { btn.innerHTML = `Save Property`; }
  });
});