// scripts/timer-manager.js

export class TimerManager {
  constructor() {
    // Load saved state from server or initialize with defaults
    const savedState = game.settings.get('chess-timer', 'timerState');
    
    this.timers = {
      a: {
        label: game.settings.get('chess-timer', 'timerALabel'),
        duration: game.settings.get('chess-timer', 'timerADuration') * 1000,
        remaining: savedState.a.remaining ?? game.settings.get('chess-timer', 'timerADuration') * 1000,
        active: savedState.a.active || false,
        startTime: savedState.a.startTime || null,
        baseRemaining: null,
        intervalId: null
      },
      b: {
        label: game.settings.get('chess-timer', 'timerBLabel'),
        duration: game.settings.get('chess-timer', 'timerBDuration') * 1000,
        remaining: savedState.b.remaining ?? game.settings.get('chess-timer', 'timerBDuration') * 1000,
        active: savedState.b.active || false,
        startTime: savedState.b.startTime || null,
        baseRemaining: null,
        intervalId: null
      }
    };
    
    // Resume any active timers from server state
    if (this.timers.a.active) this._resumeTimer('a');
    if (this.timers.b.active) this._resumeTimer('b');
    
    // Hook to handle game pause
    Hooks.on('pauseGame', (paused) => {
      if (!game.settings.get('chess-timer', 'pauseOnGamePause')) return;
      
      if (paused) {
        console.log('ChessTimer: Game paused, stopping all timers');
        this.stopAll();
      }
    });
  }
  
  // Sync local state from server (called when socket receives update)
  async syncFromServer() {
    console.log('ChessTimer: Syncing state from server');
    const savedState = await game.settings.get('chess-timer', 'timerState');
    
    // Stop local intervals
    this.timers.a.intervalId && clearInterval(this.timers.a.intervalId);
    this.timers.b.intervalId && clearInterval(this.timers.b.intervalId);
    
    // Update local state
    ['a', 'b'].forEach(type => {
      this.timers[type].remaining = savedState[type].remaining ?? this.timers[type].duration;
      this.timers[type].active = savedState[type].active || false;
      this.timers[type].startTime = savedState[type].startTime || null;
      this.timers[type].intervalId = null;
      
      // Resume timer if it was active
      if (this.timers[type].active) {
        this._resumeTimer(type);
      }
    });
    
    // Trigger UI update
    Hooks.call('chessClockTimerUpdate', 'sync', null);
  }
  
  // Save current state to server and broadcast to other clients
  async _saveStateToServer() {
    const state = {
      a: {
        remaining: this.timers.a.remaining,
        active: this.timers.a.active,
        startTime: this.timers.a.startTime
      },
      b: {
        remaining: this.timers.b.remaining,
        active: this.timers.b.active,
        startTime: this.timers.b.startTime
      }
    };
    
    await game.settings.set('chess-timer', 'timerState', state);
    
    // Broadcast to other clients
    game.socket.emit('module.chess-timer', {
      action: 'syncTimerState'
    });
  }
  
  // Resume a timer from saved state (internal use)
  _resumeTimer(type) {
    const timer = this.timers[type];
    if (!timer.startTime) return;
    
    // Calculate actual remaining time based on elapsed time since start
    const elapsed = Date.now() - timer.startTime;
    timer.remaining = Math.max(0, timer.remaining - elapsed);
    
    if (timer.remaining <= 0) {
      timer.remaining = 0;
      timer.active = false;
      this._saveStateToServer();
      return;
    }
    
    // Reset start time to now and save current remaining as base
    timer.baseRemaining = timer.remaining;
    timer.startTime = Date.now();
    this._startTimerInterval(type);
  }
  
  // Start the interval for a timer (internal use)
  _startTimerInterval(type) {
    const timer = this.timers[type];
    let wasPaused = false;
    
    timer.intervalId = setInterval(() => {
      // Check if game is paused and pause setting is active
      const pauseOnGamePause = game.settings.get('chess-timer', 'pauseOnGamePause');
      if (pauseOnGamePause && game.paused) {
        if (!wasPaused) {
          // Just got paused - update baseRemaining to current value
          if (timer.startTime && timer.baseRemaining !== null) {
            const elapsed = Date.now() - timer.startTime;
            timer.baseRemaining = Math.max(0, timer.baseRemaining - elapsed);
            timer.startTime = Date.now();
          }
          wasPaused = true;
        }
        // Don't update timer while game is paused
        return;
      }
      
      // Check if we just resumed from pause
      if (wasPaused) {
        // Reset start time to now so we don't count the paused time
        timer.startTime = Date.now();
        wasPaused = false;
      }
      
      // Calculate remaining based on start time for accuracy
      if (timer.startTime && timer.baseRemaining !== null) {
        const elapsed = Date.now() - timer.startTime;
        timer.remaining = Math.max(0, timer.baseRemaining - elapsed);
      } else {
        timer.remaining -= 100;
      }
      
      if (timer.remaining <= 0) {
        timer.remaining = 0;
        this.handleExpiry(type);
      }
      
      Hooks.call('chessClockTimerUpdate', type, timer);
    }, 100);
  }
  
  // Manual controls - always available
  async startTimer(type) {
    console.log(`ChessTimer: Starting timer ${type}`);
    const timer = this.timers[type];
    const otherType = type === 'a' ? 'b' : 'a';
    
    if (timer.active) {
      console.log(`ChessTimer: Timer ${type} already active`);
      return;
    }
    
    // Don't start a timer that's already at 0
    if (timer.remaining <= 0) {
      console.log(`ChessTimer: Timer ${type} is at 0, cannot start`);
      ui.notifications.warn(`${timer.label} has no time remaining!`);
      return;
    }
    
    // Chess clock behavior - pause the other timer
    await this.pauseTimer(otherType);
    
    timer.active = true;
    timer.startTime = Date.now();
    timer.baseRemaining = timer.remaining;
    this._startTimerInterval(type);
    
    // Save state to server and broadcast
    await this._saveStateToServer();
    
    // Trigger immediate update
    Hooks.call('chessClockTimerUpdate', type, timer);
  }
  
  async pauseTimer(type) {
    const timer = this.timers[type];
    if (!timer.active) return;
    
    console.log(`ChessTimer: Pausing timer ${type}`);
    
    // Calculate final remaining time if there was a start time
    if (timer.startTime && timer.baseRemaining !== null) {
      const elapsed = Date.now() - timer.startTime;
      timer.remaining = Math.max(0, timer.baseRemaining - elapsed);
      timer.startTime = null;
      timer.baseRemaining = null;
    }
    
    timer.active = false;
    clearInterval(timer.intervalId);
    timer.intervalId = null;
    
    // Save state to server and broadcast
    await this._saveStateToServer();
    
    // Trigger update
    Hooks.call('chessClockTimerUpdate', type, timer);
  }
  
  async resetTimer(type) {
    console.log(`ChessTimer: Resetting timer ${type}`);
    const timer = this.timers[type];
    await this.pauseTimer(type);
    timer.remaining = timer.duration;
    timer.startTime = null;
    
    // Save state to server and broadcast
    await this._saveStateToServer();
    
    Hooks.call('chessClockTimerUpdate', type, timer);
  }
  
  async stopAll() {
    console.log('ChessTimer: Stopping all timers');
    await this.pauseTimer('a');
    await this.pauseTimer('b');
  }
  
  handleExpiry(type) {
    console.log(`ChessTimer: Timer ${type} expired!`);
    this.pauseTimer(type);
    
    AudioHelper.play({ src: 'sounds/notify.wav', volume: 0.8 });
    
    const label = this.timers[type].label;
    ui.notifications.warn(`${label} time expired!`);

    // Swap to Timer B on Timer A expiry. Don't swap back on Timer B expiry.
    const myCombatIntegration = game.settings.get('chess-timer', 'myCombatIntegration');
    if (myCombatIntegration && type === 'a') {
      console.log('ChessTimer: Swapping to Timer B after Timer A expiry');
      this.startTimer('b');
      return;
    }
    
    /* Auto-swap to other timer if enabled AND the other timer has time remaining
    const autoSwap = game.settings.get('chess-timer', 'autoSwapOnExpiry');
    if (autoSwap) {
      const otherType = type === 'a' ? 'b' : 'a';
      const otherTimer = this.timers[otherType];
      
      if (otherTimer.remaining > 0) {
        console.log(`ChessTimer: Auto-swapping to timer ${otherType}`);
        this.startTimer(otherType);
      } else {
        console.log(`ChessTimer: Cannot auto-swap - timer ${otherType} also has no time remaining`);
        ui.notifications.error('Both timers have expired!');
      }
    }
  */
    // Auto-advance turn if combat integration is enabled
    const combatIntegration = game.settings.get('chess-timer', 'combatIntegration');
    const autoAdvance = game.settings.get('chess-timer', 'autoAdvance');
    
    if (((combatIntegration && autoAdvance) || myCombatIntegration) && game.combat) {
      console.log('ChessTimer: Auto-advancing combat turn');
      game.combat.nextTurn();
    }
  }
  /* Concept:
  When a player is acting, start timer A. If it ends, end their turn. No matter how their turn ends,
  switch to timer B and reset timer A.

  By default, timer B should be for the enemy. However for my uses, it will be for discussion.
  Nothing happens when timer B ends, so I can instead start the enemy turn if it occurs.

  Timer B, for my uses, will pause the timer when an NPC is acting, then resume it once it ends.
  */

  handleCombatUpdate(combat, update) {
    console.log('ChessTimer: Combat update received', { update, combatant: combat.combatant?.name });
    if (game.settings.get('chess-timer', 'combatIntegration')){
      // No combatant logic (Lancer support)
      if (!combat.combatant) {
        if (game.settings.get('chess-timer', 'myCombatIntegration')) {
          console.log('ChessTimer: No current combatant, starting timer B');
          this.startTimer('b');
          this.pauseTimer('a');
          return;
        }
        console.log('ChessTimer: No current combatant, stopping all timers');
        this.stopAll();
        return;
      } else {
        // Combatant logic
        const isPlayerToken = combat.combatant.actor?.hasPlayerOwner || false;
        if (isPlayerToken) {
          console.log('ChessTimer: Player turn detected, starting Timer A');
          if (game.settings.get('chess-timer', 'myCombatIntegration')) {
            console.log('ChessTimer: Resetting Timer A for new player turn');
            this.resetTimer('a');
          }
          this.startTimer('a');
          this.pauseTimer('b');
          return;
        } else {
          // NPC turn (already confirmed there is a combatant)
          if (game.settings.get('chess-timer', 'myCombatIntegration')) {
            console.log('ChessTimer: NPC turn detected, stopping all timers');
            this.stopAll();
            return;
          }
          console.log('ChessTimer: NPC turn detected, starting Timer B');
          this.startTimer('b');
          return;
        }
      }
   } 

  }
  /* Combat integration - only active when setting enabled
  handleCombatUpdate(combat, update) {
    console.log('ChessTimer: Combat update received', { update, combatant: combat.combatant?.name });
    
    // Only respond to combat if integration is enabled
    if (!game.settings.get('chess-timer', 'combatIntegration')) {
      console.log('ChessTimer: Combat integration disabled, ignoring');
      return;
    }
    
    if (!update.turn && !update.round) {
      console.log('ChessTimer: Not a turn/round update, ignoring');
      return;
    }
    
    const currentCombatant = combat.combatant;
    if (!currentCombatant) {
      console.log('ChessTimer: No current combatant, stopping all timers');
      this.stopAll();
      return;
    }
    
    // Lancer-compatible player detection (hopefully)
    let isPlayerToken = false;
    
    // Method 1: Check actor ownership (standard Foundry)
    if (currentCombatant.actor) {
      isPlayerToken = currentCombatant.actor.hasPlayerOwner;
    }
    
    // Method 2: Check token ownership (Lancer uses this)
    if (!isPlayerToken && currentCombatant.token) {
      const tokenDoc = currentCombatant.token;
      isPlayerToken = Object.keys(tokenDoc.ownership || {}).some(userId => {
        return userId !== "default" && 
               game.users.get(userId)?.role !== CONST.USER_ROLES.GAMEMASTER;
      });
    }
    
    // Method 3: Check combatant players array (fallback)
    if (!isPlayerToken && currentCombatant.players) {
      isPlayerToken = currentCombatant.players.length > 0;
    }
    
    console.log('ChessTimer: Combatant analysis', {
      name: currentCombatant.name,
      isPlayerToken,
      hasActor: !!currentCombatant.actor,
      hasToken: !!currentCombatant.token,
      ownership: currentCombatant.token?.ownership,
      players: currentCombatant.players
    });
    
    // Check if we should pause on unowned character turns
    const pauseOnUnowned = game.settings.get('chess-timer', 'pauseOnUnownedTurn');
    if (pauseOnUnowned && !isPlayerToken) {
      console.log('ChessTimer: Unowned character turn, pausing all timers');
      this.stopAll();
      return;
    }
    
    // Get which timer to use based on settings
    const playerTimer = game.settings.get('chess-timer', 'playerTurnTimer');
    const nonPlayerTimer = game.settings.get('chess-timer', 'nonPlayerTurnTimer');
    
    const timerToStart = isPlayerToken ? playerTimer : nonPlayerTimer;
    
    // Only reset player timer - discussion timer should resume from where it was
    if (isPlayerToken) {
      console.log(`ChessTimer: Resetting ${timerToStart} timer for new player turn`);
      this.resetTimer(timerToStart);
    } else {
      console.log(`ChessTimer: Resuming discussion timer ${timerToStart} from ${this.timers[timerToStart].remaining}ms`);
    }
    
    console.log(`ChessTimer: Starting ${timerToStart} timer (player=${isPlayerToken})`);
    this.startTimer(timerToStart);
  }
  */
}