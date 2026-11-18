const settings = document.querySelector('#settings');
const status = document.querySelector('#status');
const strength = document.querySelector('#strength');
const value = document.querySelector('#value');
const toggles = ['enabled'];

function render(options) {
  for (const key of toggles) document.getElementById(key).checked = options[key];
  strength.value = options.strength;
  value.value = Math.round((options.strength - 12) / 36 * 100) + '%';
  const active = options.enabled;
  status.textContent = active ? 'Aktivno' : 'Pauza';
  status.dataset.active = active;
}

function refresh() {
  return chrome.storage.local.get(maskDefaults).then(render);
}

async function save(options) {
  try {
    await chrome.storage.local.set(options);
    await refresh();
  } catch {
    status.textContent = 'Greška pri čuvanju';
    status.dataset.active = 'false';
  }
}

for (const key of toggles) {
  document.getElementById(key).addEventListener('change', event => save({ [key]: event.target.checked }));
}
strength.addEventListener('input', () => {
  value.value = Math.round((Number(strength.value) - 12) / 36 * 100) + '%';
});
strength.addEventListener('change', () => save({ strength: Number(strength.value) }));
chrome.storage.onChanged.addListener((_, area) => { if (area === 'local') refresh(); });
refresh().then(() => { settings.disabled = false; }).catch(() => {
  status.textContent = 'Podešavanja nedostupna';
});

async function updateTabStatus() {
  const label = document.querySelector('#tab-status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'nepomenik:status' });
    label.textContent = response.text;
  } catch {
    label.textContent = 'Otvori ili osveži YouTube snimak sa @ParlamentSrbija.';
  }
}

updateTabStatus();
setInterval(updateTabStatus, 900);
