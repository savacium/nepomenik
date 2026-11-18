importScripts('settings.js');

async function updateBadge(enabled) {
  await chrome.action.setBadgeBackgroundColor({ color: '#334252' });
  await chrome.action.setBadgeText({ text: enabled ? '' : 'Ⅱ' });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled } = await chrome.storage.local.get(maskDefaults);
  await updateBadge(enabled);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) updateBadge(changes.enabled.newValue ?? true);
});

chrome.commands.onCommand.addListener(async command => {
  if (command !== 'toggle-mask') return;
  const { enabled } = await chrome.storage.local.get(maskDefaults);
  await chrome.storage.local.set({ enabled: !enabled });
});
