// scripts/timer-ui.js

export class TimerUI {
  constructor() {
    this.element = null;
    this.render();
    
    // Listen for timer updates
    Hooks.on('chessClockTimerUpdate', () => this.render());
    
    // Re-render when sidebar changes
    Hooks.on('renderSidebar', () => this.render());
  }
  
  render() {
    const manager = game.chessClockTimer;
    if (!manager) return;
    
    // Remove existing if present
    if (this.element) {
      this.element.remove();
    }
    
    // Create the timer display
    const html = this.createHTML(manager);
    
    // Inject into sidebar
    const sidebar = document.querySelector('#sidebar');
    if (sidebar) {
      sidebar.insertAdjacentHTML('afterbegin', html);
      this.element = sidebar.querySelector('#chess-clock-timer');
      this.activateListeners();
    }
  }
  
  createHTML(manager) {
    const timerA = this.formatTimer(manager.timers.a);
    const timerB = this.formatTimer(manager.timers.b);
    const combatEnabled = game.settings.get('chess-clock-timer', 'combatIntegration');
    
    return `
      <div id="chess-clock-timer" class="chess-clock-container">
        <h3>Chess Clock</h3>
        
        <div class="timer-row ${timerA.active ? 'active' : ''} ${timerA.warning ? 'warning' : ''}">
          <span class="timer-label">${manager.timers.a.label}:</span>
          <span class="timer-display">${timerA.display}</span>
          <div class="timer-controls">
            ${!combatEnabled ? `
              <button class="start-a" title="Start ${manager.timers.a.label}">
                <i class="fas fa-play"></i>
              </button>
            ` : ''}
            <button class="reset-a" title="Reset ${manager.timers.a.label}">
              <i class="fas fa-undo"></i>
            </button>
          </div>
        </div>
        
        <div class="timer-row ${timerB.active ? 'active' : ''} ${timerB.warning ? 'warning' : ''}">
          <span class="timer-label">${manager.timers.b.label}:</span>
          <span class="timer-display">${timerB.display}</span>
          <div class="timer-controls">
            ${!combatEnabled ? `
              <button class="start-b" title="Start ${manager.timers.b.label}">
                <i class="fas fa-play"></i>
              </button>
            ` : ''}
            <button class="reset-b" title="Reset ${manager.timers.b.label}">
              <i class="fas fa-undo"></i>
            </button>
          </div>
        </div>
        
        ${combatEnabled ? '<div class="combat-mode-indicator">🔗 Combat Auto-Switch Enabled</div>' : ''}
      </div>
    `;
  }
  
  activateListeners() {
    if (!this.element) return;
    
    // Manual start buttons (only when combat integration disabled)
    this.element.querySelector('.start-a')?.addEventListener('click', () => {
      game.chessClockTimer.startTimer('a');
    });
    
    this.element.querySelector('.start-b')?.addEventListener('click', () => {
      game.chessClockTimer.startTimer('b');
    });
    
    // Reset buttons (always available)
    this.element.querySelector('.reset-a')?.addEventListener('click', () => {
      game.chessClockTimer.resetTimer('a');
    });
    
    this.element.querySelector('.reset-b')?.addEventListener('click', () => {
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