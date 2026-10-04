const text = document.querySelector('#text');
const launch = document.querySelector('#launch');
const result = document.querySelector('#result');
if (!text || !(launch instanceof HTMLButtonElement) || !result) {
  throw new Error('Child-frame fixture controls are missing');
}
const params = new URLSearchParams(location.search);
text.textContent = params.get('name') + ' otter paragraph to copy.';
launch.onclick = () => {
  result.textContent = 'Activated';
};
if (params.has('nested')) {
  const frame = document.createElement('iframe');
  frame.title = 'Nested form';
  frame.src = './frame-child.html?name=nested';
  document.body.append(frame);
}
