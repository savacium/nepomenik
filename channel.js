(() => {
  const officialChannel = 'UCghngrfQwzJ4aaPZ-UgNIZQ';
  document.addEventListener('nepomenik:check-channel', () => {
    const id = new URL(location.href).searchParams.get('v');
    const player = document.querySelector('#movie_player');
    if (location.pathname !== '/watch' || !id || !player) return;

    // Associate the owner with this exact video, including after YouTube navigation.
    const watch = player.closest('ytd-watch-flexy');
    const sources = [() => player.getPlayerResponse?.(), () => watch?.data?.playerResponse,
      () => window.ytInitialPlayerResponse];
    for (const read of sources) {
      let details;
      try { details = read()?.videoDetails; } catch { continue; }
      if (details?.videoId !== id || !details.channelId) continue;
      document.dispatchEvent(new CustomEvent('nepomenik:channel', {
        detail: { id, supported: details.channelId === officialChannel }
      }));
      return;
    }

    // Some player builds expose the owner only through the watch metadata.
    if (watch?.getAttribute('video-id') !== id) return;
    const owner = watch.querySelector('ytd-watch-metadata #owner #channel-name a[href]');
    const path = owner?.getAttribute('href')?.split(/[?#]/, 1)[0]?.replace(/\/$/, '');
    if (path?.startsWith('/@') || path?.startsWith('/channel/')) {
      document.dispatchEvent(new CustomEvent('nepomenik:channel', {
        detail: { id, supported: path.toLowerCase() === '/@parlamentsrbija' || path === '/channel/' + officialChannel }
      }));
    }
  });
})();
