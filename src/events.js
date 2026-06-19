const renderCallbacks = [];

export function onRender(cb) {
  renderCallbacks.push(cb);
}

export function render() {
  renderCallbacks.forEach(cb => cb());
}
