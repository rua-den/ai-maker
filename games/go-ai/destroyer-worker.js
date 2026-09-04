'use strict';

importScripts('./destroyer-core.js');

self.onmessage = event => {
  const message = event.data || {};
  if (message.type !== 'choose') return;
  const id = message.id;
  try {
    const result = self.GoDestroyer.choose(message.state, message.seat || 'B', message.options || {});
    self.postMessage({ type: 'result', id, move: result.move, diagnostics: result.diagnostics || null });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: error && error.message ? error.message : String(error || 'Destroyer worker failed')
    });
  }
};
