import { loginNode, fetchResults, registerNode } from './api';
import { toggleAuthTabs, setWorkspaceView } from './ui';

let sessionPin: string | null = null;
let userKeywords: string[] = [];

const initDashboard = async () => {
  const authView = document.getElementById('view-auth');
  const dashboardWorkspace = document.getElementById('view-workspace');
  if (!authView || !dashboardWorkspace) return;

  // --- Auth & Navigation Bindings ---
  document.getElementById('btn-tab-login')?.addEventListener('click', () => toggleAuthTabs(true));
  document.getElementById('btn-tab-register')?.addEventListener('click', () => toggleAuthTabs(false));
  document.getElementById('btn-logout')?.addEventListener('click', () => { 
    localStorage.removeItem('aio_pin'); 
    window.location.reload(); 
  });
  
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = (e.target as HTMLElement).querySelector('button');
    const pinInput = document.getElementById('login-pin') as HTMLInputElement;
    const pin = pinInput ? pinInput.value.trim() : "";
    
    if (btn) { btn.innerText = "Authenticating..."; btn.setAttribute('disabled', 'true'); }
    try {
      const data = await loginNode(pin);
      sessionPin = pin; localStorage.setItem('aio_pin', pin);
      try { userKeywords = JSON.parse(data.keywords || "[]"); } catch {}
      setWorkspaceView(pin);
      checkAndGenerateReport();
    } catch (err: any) { 
      alert(err.message || "Login failed."); 
    } finally { 
      if (btn) { btn.innerText = "Next"; btn.removeAttribute('disabled'); } 
    }
  });

  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
     e.preventDefault();
     const btn = (e.target as HTMLElement).querySelector('button');
     if (btn) { btn.innerHTML = `Generating...`; btn.setAttribute('disabled', 'true'); }
     const emailInput = document.getElementById('register-email') as HTMLInputElement;
     
     try {
       const res = await registerNode(emailInput ? emailInput.value : "");
       if (res.ok && res.data && res.data.pin) {
         const generatedPin = res.data.pin;
         document.getElementById('register-ui')?.classList.add('hidden');
         document.getElementById('pin-panel')?.classList.replace('hidden', 'flex');
         const pinDisplay = document.getElementById('generated-pin');
         if (pinDisplay) pinDisplay.innerText = generatedPin;
         
         const ackBtn = document.getElementById('btn-acknowledge-pin');
         if (ackBtn) {
           ackBtn.onclick = () => {
             sessionPin = generatedPin;
             localStorage.setItem('aio_pin', generatedPin);
             setWorkspaceView(generatedPin);
             document.getElementById('config-modal')?.classList.remove('hidden');
           };
         }
       }
     } catch { 
       alert("Registration failed."); 
     } finally { 
       if (btn) { btn.innerHTML = `Create New Node`; btn.removeAttribute('disabled'); } 
     }
  });

  // --- UI Utility: Chip Inputs ---
  const setupChipInput = (containerId: string, inputId: string, maxChips: number = 10, initialChips: string[] = []) => {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (!container || !input) return () => [];

    let chips: string[] = [...initialChips];

    const renderChips = () => {
      container.querySelectorAll('.domain-chip').forEach(el => el.remove());
      
      chips.forEach((chipText, index) => {
        const chip = document.createElement('div');
        chip.className = 'domain-chip flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#232429] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm animate-fade-in';
        chip.innerHTML = `
          ${chipText}
          <button type="button" class="text-gray-400 hover:text-red-500 focus:outline-none transition-colors" data-index="${index}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        `;
        
        chip.querySelector('button')?.addEventListener('click', (e) => {
          const idx = parseInt((e.currentTarget as HTMLButtonElement).dataset.index || '0');
          chips.splice(idx, 1);
          renderChips();
        });

        container.insertBefore(chip, input);
      });
    };

    const addChip = (text: string) => {
      const cleanText = text.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (cleanText && !chips.includes(cleanText) && chips.length < maxChips) {
        chips.push(cleanText);
        renderChips();
      }
      input.value = '';
    };

    renderChips(); // Initial render

    container.addEventListener('click', () => input.focus());

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addChip(input.value);
      } else if (e.key === 'Backspace' && input.value === '' && chips.length > 0) {
        chips.pop();
        renderChips();
      }
    });

    input.addEventListener('blur', () => {
      if (input.value.trim()) addChip(input.value);
    });

    return () => chips;
  };

  // Restore saved config from LocalStorage
  const savedDomain = JSON.parse(localStorage.getItem('aio_domain') || '[]');
  const savedCompetitors = JSON.parse(localStorage.getItem('aio_competitors') || '[]');

  const getMyDomains = setupChipInput('my-domain-container', 'my-domain-input', 1, savedDomain);
  const getCompetitors = setupChipInput('competitors-container', 'competitors-input', 10, savedCompetitors);

  // --- Modal Logic ---
  const modal = document.getElementById('config-modal');
  const openModal = () => modal?.classList.remove('hidden');
  const closeModal = () => modal?.classList.add('hidden');

  document.getElementById('btn-open-config')?.addEventListener('click', openModal);
  document.getElementById('btn-empty-config')?.addEventListener('click', openModal);
  document.getElementById('btn-close-config')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-config')?.addEventListener('click', closeModal);

  document.getElementById('btn-save-config')?.addEventListener('click', () => {
     const myDomains = getMyDomains();
     if (myDomains.length === 0) return alert("Please enter your domain to generate a report.");
     
     localStorage.setItem('aio_domain', JSON.stringify(myDomains));
     localStorage.setItem('aio_competitors', JSON.stringify(getCompetitors()));
     closeModal();
     generateReport();
  });

  // --- Report Generation ---
  const generateReport = async () => {
     const myDomains = getMyDomains();
     const competitors = getCompetitors();
     
     if (myDomains.length === 0) return; // Prevent generation if no domain
     const domain = myDomains[0];

     const emptyEl = document.getElementById('report-empty');
     const resultsEl = document.getElementById('report-results');
     const loadingEl = document.getElementById('report-loading');
     
     emptyEl?.classList.add('hidden');
     resultsEl?.classList.add('hidden');
     loadingEl?.classList.remove('hidden'); loadingEl?.classList.add('flex');

     let totalSearches = 0;
     const domainStats = { citations: 0, organic: 0 };
     const compStats: Record<string, { citations: number, organic: number }> = {};
     competitors.forEach(c => compStats[c] = { citations: 0, organic: 0 });

     for (const kw of userKeywords) {
        try {
           const data = await fetchResults(kw, { days: 30 });
           totalSearches += data.length;

           data.forEach((row: any) => {
              const sources = (row.source_links || '[]').toLowerCase();
              const organics = (row.organic_links || '[]').toLowerCase();
              
              if (sources.includes(domain)) domainStats.citations++;
              if (organics.includes(domain)) domainStats.organic++;

              competitors.forEach(comp => {
                 if (sources.includes(comp)) compStats[comp].citations++;
                 if (organics.includes(comp)) compStats[comp].organic++;
              });
           });
        } catch (e) {
           console.error("Error fetching data for query:", kw, e);
        }
     }

     const calcPct = (count: number) => totalSearches > 0 ? ((count / totalSearches) * 100).toFixed(1) : "0.0";

     const citeEl = document.getElementById('citation-metric');
     const orgEl = document.getElementById('organic-metric');
     if (citeEl) citeEl.innerText = `${calcPct(domainStats.citations)}%`;
     if (orgEl) orgEl.innerText = `${calcPct(domainStats.organic)}%`;

     const tbody = document.getElementById('competitor-table-body');
     if (tbody) {
        tbody.innerHTML = `
           <tr class="bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-800">
              <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">${domain} (You)</th>
              <td class="px-6 py-4 text-center text-gray-900 dark:text-white font-medium">${calcPct(domainStats.citations)}%</td>
              <td class="px-6 py-4 text-center text-gray-900 dark:text-white font-medium">${calcPct(domainStats.organic)}%</td>
           </tr>
        ` + competitors.map(comp => `
           <tr class="bg-white border-b dark:bg-[#1C1D21] dark:border-gray-800">
              <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-gray-300">${comp}</th>
              <td class="px-6 py-4 text-center text-gray-600 dark:text-gray-400">${calcPct(compStats[comp].citations)}%</td>
              <td class="px-6 py-4 text-center text-gray-600 dark:text-gray-400">${calcPct(compStats[comp].organic)}%</td>
           </tr>
        `).join('');
     }

     loadingEl?.classList.add('hidden'); loadingEl?.classList.remove('flex');
     resultsEl?.classList.remove('hidden');
  };

  const checkAndGenerateReport = () => {
    const myDomains = getMyDomains();
    if (myDomains.length > 0) {
      generateReport();
    } else {
      document.getElementById('report-empty')?.classList.remove('hidden');
      document.getElementById('report-empty')?.classList.add('flex');
    }
  };

  // --- Session Restoration ---
  const savedPin = localStorage.getItem('aio_pin');
  if (savedPin) {
    sessionPin = savedPin;
    setWorkspaceView(savedPin);
    try {
      const data = await loginNode(savedPin);
      userKeywords = JSON.parse(data.keywords || "[]");
      checkAndGenerateReport();
    } catch (e: any) {
      if (e.message && (e.message.includes('Invalid') || e.message.includes('Format'))) {
        localStorage.removeItem('aio_pin'); window.location.reload();
      }
    }
  }
};

document.addEventListener('astro:page-load', initDashboard);