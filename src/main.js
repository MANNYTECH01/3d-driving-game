import { Game } from './core/Game.js';
import { Menus } from './ui/Menus.js';

/**
 * Boot sequence: creates the renderer, builds the world and the UI while
 * driving the loading screen progress bar, then reveals the main menu.
 */
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

async function boot() {
  const bar = document.getElementById('loading-bar');
  const text = document.getElementById('loading-text');
  const step = async (p, t) => {
    bar.style.width = p + '%';
    text.textContent = t;
    await nextFrame();
    await nextFrame();
  };

  await step(10, 'Creating renderer...');
  const game = new Game(document.getElementById('app'));

  await step(45, 'Building world...');
  game.initWorld();

  await step(80, 'Preparing garage and UI...');
  const menus = new Menus(game);

  await step(100, 'Ready');
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
    menus.showMain();
  }, 350);

  game.start();
}

boot();
