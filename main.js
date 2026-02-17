import { TimerManager } from './scripts/timer-manager.js';
import { TimerUI } from './scripts/timer-ui.js';

Hooks.once('init', () => {
  console.log('Chess Timer | Initializing');
  
  // Register settings
  game.settings.register('chess-timer', 'timerALabel', {
    name: 'Timer A Label',
    scope: 'world',
    config: true,
    type: String,
    default: 'Discussion'
  });
  
  game.settings.register('chess-timer', 'timerADuration', {
    name: 'Timer A Duration (seconds)',
    scope: 'world',
    config: true,
    type: Number,
    default: 900
  });
  
  game.settings.register('chess-timer', 'timerBLabel', {
    name: 'Timer B Label',
    scope: 'world',
    config: true,
    type: String,
    default: 'Action'
  });
  
  game.settings.register('chess-timer', 'timerBDuration', {
    name: 'Timer B Duration (seconds)',
    scope: 'world',
    config: true,
    type: Number,
    default: 180
  });
  
  game.settings.register('chess-timer', 'combatIntegration', {
    name: 'Combat Integration',
    hint: 'Automatically switch timers based on whose turn it is in combat',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  game.settings.register('chess-timer', 'playerTurnTimer', {
    name: 'Player Turn Timer',
    hint: 'Which timer to use when it is a player\'s turn',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      'a': 'Timer A',
      'b': 'Timer B'
    },
    default: 'b'
  });
  
  game.settings.register('chess-timer', 'nonPlayerTurnTimer', {
    name: 'Non-Player Turn Timer',
    hint: 'Which timer to use when it is NOT a player\'s turn',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      'a': 'Timer A',
      'b': 'Timer B'
    },
    default: 'a'
  });
  
  game.settings.register('chess-timer', 'autoSwapOnExpiry', {
    name: 'Auto-swap timer on expiry',
    hint: 'When a timer expires, automatically start the other timer',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  
  game.settings.register('chess-timer', 'autoAdvance', {
    name: 'Auto-advance turn on expiry',
    hint: 'Only applies when Combat Integration is enabled',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // Setting: Pause timers when game is paused
  game.settings.register('chess-timer', 'pauseOnGamePause', {
    name: 'Pause Timers on Game Pause',
    hint: 'Automatically pause both timers when the game is paused',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Setting: Pause timers when unowned character is acting
  game.settings.register('chess-timer', 'myCombatIntegration', {
    name: 'My Combat Integration',
    hint: 'Timer B for player discussion, Timer A for Player turns, NPC Turns pause timers.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // Timer state storage (synced across all clients)
  game.settings.register('chess-timer', 'timerState', {
    scope: 'world',
    config: false,
    type: Object,
    default: {
      a: { remaining: null, active: false, startTime: null },
      b: { remaining: null, active: false, startTime: null }
    }
  });
});

Hooks.once('ready', () => {
  console.log('Chess Timer | Ready');
  
  // Register socket for timer synchronization
  game.socket.on('module.chess-timer', (data) => {
    console.log('ChessTimer: Received socket data', data);
    if (data.action === 'syncTimerState' && game.chessClockTimer) {
      game.chessClockTimer.syncFromServer();
    }
  });
  
  // Initialize timer manager
  game.chessClockTimer = new TimerManager();
  
  // Initialize and render UI window
  const timerUI = new TimerUI();
  timerUI.render(true);
  
  // Store reference globally
  game.chessClockTimerUI = timerUI;
  
  // Listen for combat updates
  Hooks.on('updateCombat', (combat, update, options, userId) => {
    game.chessClockTimer.handleCombatUpdate(combat, update);
  });
  
  Hooks.on('deleteCombat', () => {
    game.chessClockTimer.stopAll();
  });
});