export class TimerUI extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'chess-clock-timer',
      title: 'Chess Clock',
      template: null,
      width: 320,
      height: 'auto',
      resizable: false,
      minimizable: true,
      classes: ['chess-clock-window'],
      popOut: true
    });
  }
  
  constructor() {
    super();
    
    // Listen for timer updates - just re-render data
    Hooks.on('chessClockTimerUpdate', () => {
      if (this.rendered) {
        this.render(false); // false = don't force, just update
      }
    });
  }
  
  async _renderInner() {
    const manager = game.chessClockTimer;
    if (!manager) return $('<div>Loading...</div>');
    
    const timerA = this.formatTimer(manager.timers.a);
    const timerB = this.formatTimer(manager.timers.b);
    const combatEnabled = game.settings.get('chess-timer', 'combatIntegration');
    
    const html = `
      <div class="chess-clock-content">
        <div class="timer-row ${timerA.active ? 'active' : ''} ${timerA.warning ? 'warning' : ''}">
          <span class="timer-label">${manager.timers.a.label}:</span>
          <span class="timer-display">${timerA.display}</span>
          <div class="timer-controls">
            ${!combatEnabled ? `
              <button class="start-a" title="Start ${manager.timers.a.label}" type="button">
                <i class="fas fa-play"></i>
              </button>
            ` : ''}
            <button class="reset-a" title="Reset ${manager.timers.a.label}" type="button">
              <i class="fas fa-undo"></i>
            </button>
          </div>
        </div>
        
        <div class="timer-row ${timerB.active ? 'active' : ''} ${timerB.warning ? 'warning' : ''}">
          <span class="timer-label">${manager.timers.b.label}:</span>
          <span class="timer-display">${timerB.display}</span>
          <div class="timer-controls">
            ${!combatEnabled ? `
              <button class="start-b" title="Start ${manager.timers.b.label}" type="button">
                <i class="fas fa-play"></i>
              </button>
            ` : ''}
            <button class="reset-b" title="Reset ${manager.timers.b.label}" type="button">
              <i class="fas fa-undo"></i>
            </button>
          </div>
        </div>
        
        ${combatEnabled ? '<div class="combat-mode-indicator">🔗 Combat Auto-Switch Enabled</div>' : ''}
      </div>
    `;
    
    return $(html);
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    console.log('ChessTimer: Activating listeners on Application window');
    
    // Attach event listeners
    html.find('.start-a').click((e) => {
      e.preventDefault();
      console.log('ChessTimer: Start A clicked');
      game.chessClockTimer.startTimer('a');
    });
    
    html.find('.start-b').click((e) => {
      e.preventDefault();
      console.log('ChessTimer: Start B clicked');
      game.chessClockTimer.startTimer('b');
    });
    
    html.find('.reset-a').click((e) => {
      e.preventDefault();
      console.log('ChessTimer: Reset A clicked');
      game.chessClockTimer.resetTimer('a');
    });
    
    html.find('.reset-b').click((e) => {
      e.preventDefault();
      console.log('ChessTimer: Reset B clicked');
      game.chessClockTimer.resetTimer('b');
    });
  }
  
  formatTimer(timer) {
    const totalSeconds = Math.ceil(timer.remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return {
      display: `${minutes}:${seconds.toString().padStart(2, '0')}`,
      active: timer.active,
      warning: timer.remaining < 30000
    };
  }
}