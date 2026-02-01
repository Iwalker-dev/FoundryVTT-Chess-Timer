export class TimerManager {
  constructor() {
    this.timers = {
      a: {
        label: game.settings.get('chess-clock-timer', 'timerALabel'),
        duration: game.settings.get('chess-clock-timer', 'timerADuration') * 1000,
        remaining: game.settings.get('chess-clock-timer', 'timerADuration') * 1000,
        active: false,
        intervalId: null
      },
      b: {
        label: game.settings.get('chess-clock-timer', 'timerBLabel'),
        duration: game.settings.get('chess-clock-timer', 'timerBDuration') * 1000,
        remaining: game.settings.get('chess-clock-timer', 'timerBDuration') * 1000,
        active: false,
        intervalId: null
      }
    };
  }
  
  // Manual controls - always available
  startTimer(type) {
    const timer = this.timers[type];
    const otherType = type === 'a' ? 'b' : 'a';
    
    if (timer.active) return;
    
    // Chess clock behavior - pause the other timer
    this.pauseTimer(otherType);
    
    timer.active = true;
    timer.intervalId = setInterval(() => {
      timer.remaining -= 100;
      
      if (timer.remaining <= 0) {
        timer.remaining = 0;
        this.handleExpiry(type);
      }
      
      Hooks.call('chessClockTimerUpdate', type, timer);
    }, 100);
  }
  
  pauseTimer(type) {
    const timer = this.timers[type];
    if (!timer.active) return;
    
    timer.active = false;
    clearInterval(timer.intervalId);
    timer.intervalId = null;
  }
  
  resetTimer(type) {
    const timer = this.timers[type];
    this.pauseTimer(type);
    timer.remaining = timer.duration;
    Hooks.call('chessClockTimerUpdate', type, timer);
  }
  
  stopAll() {
    this.pauseTimer('a');
    this.pauseTimer('b');
  }
  
  handleExpiry(type) {
    this.pauseTimer(type);
    
    AudioHelper.play({ src: 'sounds/notify.wav', volume: 0.8 });
    
    const label = this.timers[type].label;
    ui.notifications.warn(`${label} time expired!`);
    
    // Only auto-advance if combat integration is enabled
    if (game.settings.get('chess-clock-timer', 'combatIntegration') &&
        game.settings.get('chess-clock-timer', 'autoAdvance') &&
        game.combat) {
      game.combat.nextTurn();
    }
  }
  
  // Combat integration - only active when setting enabled
  handleCombatUpdate(combat, update) {
    // Only respond to combat if integration is enabled
    if (!game.settings.get('chess-clock-timer', 'combatIntegration')) return;
    
    if (!update.turn && !update.round) return;
    
    const currentCombatant = combat.combatant;
    if (!currentCombatant) {
      this.stopAll();
      return;
    }
    
    const isPlayerToken = currentCombatant.actor?.hasPlayerOwner || 
                          currentCombatant.players?.length > 0;
    
    if (isPlayerToken) {
      this.startTimer('b'); // Timer B for player actions
    } else {
      this.startTimer('a'); // Timer A for non-player (discussion)
    }
  }
}