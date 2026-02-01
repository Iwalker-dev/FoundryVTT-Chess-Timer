import { TimerManager } from './scripts/timer-manager.js';
import { TimerUI } from './scripts/timer-ui.js';

Hooks.once('init', () => {
  console.log('Chess Clock Timer | Initializing');
  
    // Register settings
    game.settings.register('chess-clock-timer', 'timerALabel', {
    name: 'Timer A Label',
    scope: 'world',
    config: true,
    type: String,
    default: 'Discussion'
    });

    game.settings.register('chess-clock-timer', 'timerADuration', {
    name: 'Timer A Duration (seconds)',
    scope: 'world',
    config: true,
    type: Number,
    default: 900
    });

    game.settings.register('chess-clock-timer', 'timerBLabel', {
    name: 'Timer B Label',
    scope: 'world',
    config: true,
    type: String,
    default: 'Action'
    });

    game.settings.register('chess-clock-timer', 'timerBDuration', {
    name: 'Timer B Duration (seconds)',
    scope: 'world',
    config: true,
    type: Number,
    default: 180
    });

    game.settings.register('chess-clock-timer', 'combatIntegration', {
    name: 'Combat Integration',
    hint: 'Automatically switch timers based on whose turn it is in combat',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
    });

    game.settings.register('chess-clock-timer', 'autoAdvance', {
    name: 'Auto-advance turn on expiry',
    hint: 'Only applies when Combat Integration is enabled',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
    });
});

Hooks.once('ready', () => {
  // Initialize timer manager
  game.chessClockTimer = new TimerManager();
  
  // Initialize UI
  new TimerUI();
  
  // Listen for combat updates
  Hooks.on('updateCombat', (combat, update, options, userId) => {
    game.chessClockTimer.handleCombatUpdate(combat, update);
  });
  
  Hooks.on('deleteCombat', () => {
    game.chessClockTimer.stopAll();
  });
});