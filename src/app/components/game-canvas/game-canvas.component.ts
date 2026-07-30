import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';

import { GameSocketService } from '../../services/game-socket.service';
import { getEnemyBehaviorType } from './enemy-logic/enemy-ai';
import { getEnemyCaptureThreshold, selectEnemyTargetId } from './enemy-logic/enemy-system';

@Component({
  selector: 'app-game-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-canvas.component.html',
  styleUrls: ['./game-canvas.component.css']
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @ViewChild('gameCanvas')
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;

  private player = {
    x: 100,
    y: 100,
    width: 20,
    height: 20
  };

  private canvasWidth = 1280;
  private canvasHeight = 720;
  private playerId: string = '';
  private collectionRadius: number = 30;
  private fireDepositCooldown = false;
  private lastPositionSent = 0;
  private animationFrameId: number | null = null;
  private isExiting = false;
  private destroy$ = new Subject<void>();
  private subscriptions: Subscription[] = [];

  players: any = {};
  resources: any[] = [];
  resourcesCollected: any = {};
  fire: any = {
    x: 640,
    y: 360,
    radius: 70,
    intensity: 100
  };
  enemies: any[] = [];
  // Players marked as removed after being caught by an enemy
  deadPlayers: Set<string> = new Set();

  dayNight = 'DAY';
  roomDifficulty = 'MEDIUM';
  decorations: any[] = [];
  gameOver = false;
  scoreAtDeath = 0;
  deathMessage = '';
  private resultSubmitted = false;
  private latestPlayerScore = 0;

  constructor(
    private gameSocket: GameSocketService
  ) { }

  ngAfterViewInit(): void {

    const canvas = this.canvasRef.nativeElement;

    this.ctx = canvas.getContext('2d')!;

    this.generateDecorations();
    this.roomDifficulty = this.normalizeDifficulty(this.route.snapshot.queryParamMap.get('difficulty') || this.roomDifficulty);

    // The socket should already be connected and joined from StartScreenComponent.
    // If user navigated directly to /game without going through /start, redirect.
    if (!this.gameSocket.isConnected()) {
      this.router.navigate(['/start']);
      return;
    }

    // Get the socket ID immediately since we are already connected and joined
    this.playerId = this.gameSocket.getSocketId() || '';
    if (this.playerId && !this.resourcesCollected[this.playerId]) {
      this.resourcesCollected[this.playerId] = 0;
    }

    this.subscribeSockets();
    this.gameSocket.requestInitialWorldState();

    this.gameLoop();
  }

  ngOnDestroy(): void {
    this.isExiting = true;
    this.stopGameLoop();

    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.destroy$.next();
    this.destroy$.complete();
    
    // Leave the room
    this.gameSocket.leaveRoom();
  }

  private generateDecorations(): void {
    this.decorations = [];
    const types = ['tree', 'rock', 'grass'];
    // Generar 25 elementos decorativos fuera del radio de la fogata
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * this.canvasWidth;
      const y = Math.random() * this.canvasHeight;

      // Mantener libre el centro para la fogata
      const dx = x - this.fire.x;
      const dy = y - this.fire.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 110) {
        i--;
        continue;
      }

      const type = types[Math.floor(Math.random() * types.length)];
      const size = 12 + Math.random() * 14;
      this.decorations.push({ x, y, type, size });
    }
  }

  private drawDecorations(): void {
    this.decorations.forEach(dec => {
      if (dec.type === 'tree') {
        // Tronco plano
        this.ctx.fillStyle = '#6d4c41';
        this.ctx.fillRect(dec.x - 3, dec.y, 6, dec.size * 0.8);
        
        // Hojas planas (copa)
        this.ctx.beginPath();
        this.ctx.fillStyle = this.dayNight === 'DAY' ? '#2ecc71' : '#1b8a4f';
        this.ctx.arc(dec.x, dec.y - 4, dec.size * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (dec.type === 'rock') {
        // Roca plana
        this.ctx.beginPath();
        this.ctx.fillStyle = this.dayNight === 'DAY' ? '#bdc3c7' : '#7f8c8d';
        this.ctx.arc(dec.x, dec.y, dec.size * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Sombra plana de la roca
        this.ctx.beginPath();
        this.ctx.fillStyle = this.dayNight === 'DAY' ? '#95a5a6' : '#5d6868';
        this.ctx.arc(dec.x - 2, dec.y - 1, dec.size * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (dec.type === 'grass') {
        // Mechón de hierba plano
        this.ctx.strokeStyle = this.dayNight === 'DAY' ? '#27ae60' : '#1e7b43';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(dec.x, dec.y);
        this.ctx.lineTo(dec.x, dec.y - dec.size * 0.5);
        this.ctx.moveTo(dec.x, dec.y);
        this.ctx.lineTo(dec.x - 4, dec.y - dec.size * 0.35);
        this.ctx.moveTo(dec.x, dec.y);
        this.ctx.lineTo(dec.x + 4, dec.y - dec.size * 0.35);
        this.ctx.stroke();
      }
    });
  }

  private subscribeSockets(): void {

    this.subscriptions.push(
      this.gameSocket.onInitialState()
        .subscribe((state: any) => {

          this.players = state.players;
          this.resources = state.resources;
          this.dayNight = state.dayNight;
          this.roomDifficulty = this.normalizeDifficulty(state.difficulty || this.roomDifficulty);
          this.fire = state.fire || this.fire;
          this.enemies = state.enemies || [];
          this.latestPlayerScore = this.getCurrentPlayerScoreFromState(state.players);

          // Inicializar contadores para todos los jugadores usando el estado del servidor
          Object.keys(state.players).forEach(playerId => {
            this.resourcesCollected[playerId] = state.players[playerId].collected || 0;
          });

          // Forzar render inmediato del estado inicial recibido
          this.render();
        })
    );

    this.subscriptions.push(
      this.gameSocket.onPlayersUpdated()
        .subscribe((players: any) => {

          this.players = players;
          this.latestPlayerScore = this.getCurrentPlayerScoreFromState(players);

          // Actualizar contadores usando la información del servidor
          Object.keys(players).forEach(playerId => {
            this.resourcesCollected[playerId] = players[playerId].collected || 0;
          });
        })
    );

    this.subscriptions.push(
      this.gameSocket.onResourceCreated()
        .subscribe((resource: any) => {

          this.resources.push(resource);
        })
    );

    this.subscriptions.push(
      this.gameSocket.onResourceCollected()
        .subscribe((data: any) => {

          this.resourcesCollected[data.playerId] =
            (this.resourcesCollected[data.playerId] || 0) + 1;

          // Remover el recurso de la lista
          this.resources = this.resources.filter(r => r.id !== data.resourceId);
        })
    );

    this.subscriptions.push(
      this.gameSocket.onDayNightChanged()
        .subscribe((state: string) => {

          this.dayNight = state;
        })
    );

    this.subscriptions.push(
      this.gameSocket.onFireUpdated()
        .subscribe((fire: any) => {
          this.fire = fire;
        })
    );

    this.subscriptions.push(
      this.gameSocket.onEnemiesUpdated()
        .subscribe((enemies: any) => {
          const serverEnemies = enemies || [];
          // Preserve local properties like targetId when merging server updates
          this.enemies = serverEnemies.map((se: any) => {
            const local = (this.enemies || []).find((le: any) => le.id === se.id);
            return Object.assign({}, se, { targetId: local ? local.targetId : se.targetId });
          });
        })
    );

    this.subscriptions.push(
      this.gameSocket.onForceDisconnect()
        .subscribe((data: any) => {
          alert(data.message || 'Se ha iniciado sesión desde otro dispositivo. Desconectando...');
          this.router.navigate(['/login']);
        })
    );
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {

    const speed = 10;
    let newX = this.player.x;
    let newY = this.player.y;

    switch (event.key.toLowerCase()) {

      case 'arrowup':
      case 'w':
        newY -= speed;
        break;

      case 'arrowdown':
      case 's':
        newY += speed;
        break;

      case 'arrowleft':
      case 'a':
        newX -= speed;
        break;

      case 'arrowright':
      case 'd':
        newX += speed;
        break;

      default:
        return;
    }

    // Clamp player position to canvas bounds (1280x720)
    this.player.x = Math.max(0, Math.min(newX, this.canvasWidth - this.player.width));
    this.player.y = Math.max(0, Math.min(newY, this.canvasHeight - this.player.height));

    this.gameSocket.sendPlayerPosition(
      this.player.x,
      this.player.y
    );
  }

  private checkResourceCollisions(): void {

    // Usar la posición del servidor si está disponible, sino usar la local
    const playerPos = this.playerId && this.players[this.playerId]
      ? this.players[this.playerId]
      : this.player;

    for (let i = this.resources.length - 1; i >= 0; i--) {

      const resource = this.resources[i];
      const dx = playerPos.x - resource.x;
      const dy = playerPos.y - resource.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.collectionRadius) {

        this.gameSocket.sendResourceCollected(resource.id);
        this.resources.splice(i, 1);
      }
    }
  }

  private checkEnemyCollisions(): void {
    if (!this.players || !this.enemies) return;

    // Check collisions between any enemy and any alive player
    for (const enemy of this.enemies || []) {
      // Only check collisions with visible enemies
      if (!enemy.visible) continue;
      
      for (const [playerId, player] of Object.entries(this.players) as any) {
        if (this.deadPlayers.has(playerId)) continue;

        const px = player.x;
        const py = player.y;
        const dx = px - enemy.x;
        const dy = py - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const collisionThreshold = getEnemyCaptureThreshold(enemy, player);

        if (distance < collisionThreshold) {
          this.handlePlayerCaught(enemy, playerId);
          // break to avoid double-handling the same enemy this frame
          break;
        }
      }
    }
  }

  private handlePlayerCaught(enemy: any, caughtPlayerId: string): void {
    if (!caughtPlayerId) return;

    // Mark player as dead so they disappear from rendering
    this.deadPlayers.add(caughtPlayerId);

    // Remove the player from local state immediately so enemies stop targeting them
    if (this.players && this.players[caughtPlayerId]) {
      delete this.players[caughtPlayerId];
    }
    if (this.resourcesCollected && this.resourcesCollected[caughtPlayerId] !== undefined) {
      delete this.resourcesCollected[caughtPlayerId];
    }

    // If the local player was caught, trigger game over/modal and notify the server
    if (caughtPlayerId === this.playerId) {
      this.triggerGameOver();
      this.gameSocket.notifyPlayerDeath();
    }

    // Retarget the enemy to the nearest alive player
    const nearestId = selectEnemyTargetId(enemy, this.players, this.deadPlayers);
    if (nearestId && nearestId === caughtPlayerId) {
      return;
    }

    if (nearestId) {
      enemy.targetId = nearestId;
    } else {
      delete enemy.targetId;
    }
  }

  private getNearestAlivePlayerId(enemy: any): string | null {
    if (!this.players) return null;

    return selectEnemyTargetId(enemy, this.players, this.deadPlayers);
  }

  private triggerGameOver(): void {
    if (this.gameOver) {
      return;
    }

    this.gameOver = true;
    this.scoreAtDeath = this.getCurrentPlayerScore();
    this.deathMessage = 'Un enemigo te alcanzó.';
  }

  private gameLoop(): void {
    if (this.gameOver || this.isExiting) {
      this.render();
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());

    // Enviar posición constantemente cada ~50ms para que el servidor tenga posición actualizada
    // Esto asegura que los enemigos persigan la posición correcta todo el tiempo
    if (!this.lastPositionSent || Date.now() - this.lastPositionSent > 50) {
      this.gameSocket.sendPlayerPosition(this.player.x, this.player.y);
      this.lastPositionSent = Date.now();
    }

    this.checkResourceCollisions();
    this.checkEnemyCollisions();
    this.checkFireDeposit();
    this.render();
  }

  private checkFireDeposit(): void {
    if (!this.playerId) {
      return;
    }

    const playerPos = this.players[this.playerId] || this.player;
    const dx = playerPos.x - this.fire.x;
    const dy = playerPos.y - this.fire.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const atFire = distance < this.fire.radius;
    const inventory = this.resourcesCollected[this.playerId] || 0;

    if (atFire && inventory > 0 && !this.fireDepositCooldown) {
      this.fireDepositCooldown = true;
      this.gameSocket.sendDepositResources();
    }

    if (!atFire) {
      this.fireDepositCooldown = false;
    }
  }

  leaveGame(): void {
    if (this.resultSubmitted) {
      this.cleanupAndNavigate();
      return;
    }

    this.resultSubmitted = true;
    const score = this.getCurrentPlayerScore();
    this.gameSocket.submitResult(score, this.normalizeDifficulty(this.roomDifficulty))
      .catch(err => console.warn('Failed to submit result', err))
      .finally(() => {
        this.cleanupAndNavigate();
      });
  }

  private cleanupAndNavigate(): void {
    this.isExiting = true;
    this.stopGameLoop();

    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    // Clear local state
    this.players = {};
    this.resources = [];
    this.resourcesCollected = {};
    this.enemies = [];
    this.deadPlayers.clear();
    this.resultSubmitted = false;
    this.gameOver = false;
    this.player = {
      x: 100,
      y: 100,
      width: 20,
      height: 20
    };
    this.playerId = '';
    this.lastPositionSent = 0;

    // Leave the room explicitly
    this.gameSocket.leaveRoom();
    
    // Navigate to start
    this.router.navigate(['/start']);
  }

  private stopGameLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private normalizeDifficulty(difficulty: string | null | undefined): 'EASY' | 'MEDIUM' | 'HARD' {
    return (difficulty === 'EASY' || difficulty === 'HARD' ? difficulty : 'MEDIUM') as 'EASY' | 'MEDIUM' | 'HARD';
  }

  private getCurrentPlayerScoreFromState(players: any): number {
    if (!this.playerId || !players || !players[this.playerId]) {
      return this.latestPlayerScore;
    }
    return Number(players[this.playerId].score || 0);
  }

  private getCurrentPlayerScore(): number {
    const stateScore = this.playerId && this.players && this.players[this.playerId]
      ? Number(this.players[this.playerId].score || 0)
      : 0;
    return Math.max(this.latestPlayerScore, stateScore);
  }

  private render(): void {

    const canvas = this.canvasRef.nativeElement;

    // Fondo plano: Verde menta/turquesa claro de día, azul pizarra profundo de noche
    if (this.dayNight === 'DAY') {
      this.ctx.fillStyle = '#a2e8dd';
    } else {
      this.ctx.fillStyle = '#1c2d37';
    }

    this.ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Dibujar elementos decorativos del fondo
    this.drawDecorations();

    /*
    |--------------------------------------------------------------------------
    | RECURSOS (Troncos planos con hojas verdes)
    |--------------------------------------------------------------------------
    */
    this.resources.forEach(resource => {
      const rx = resource.x;
      const ry = resource.y;

      // Tronco plano
      this.ctx.fillStyle = '#a1887f';
      this.ctx.fillRect(rx - 4, ry + 1, 8, 7);

      // Copa de hojas (3 círculos planos superpuestos)
      this.ctx.beginPath();
      this.ctx.arc(rx, ry - 3, 7, 0, Math.PI * 2);
      this.ctx.fillStyle = '#2ecc71';
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(rx - 4, ry, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#27ae60';
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(rx + 4, ry, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#2ecc71';
      this.ctx.fill();
    });

    this.drawFire();

    this.drawEnemies();

    /*
    |--------------------------------------------------------------------------
    | JUGADORES (Estilo plano con ojos expresivos)
    |--------------------------------------------------------------------------
    */
    for (const [playerId, player] of Object.entries(this.players) as any) {
      if (this.deadPlayers.has(playerId)) continue; // hide players caught by enemies

      const isMe = playerId === this.playerId;
      const px = player.x;
      const py = player.y;
      const pw = this.player.width;
      const ph = this.player.height;

      // Use cosmetic color if equipped, otherwise default colors
      const playerColor = player.cosmeticColor
        ? player.cosmeticColor
        : (isMe ? '#7fffd4' : '#ff7675');

      this.ctx.fillStyle = playerColor;
      this.ctx.strokeStyle = '#23323c';
      this.ctx.lineWidth = 2.5;

      this.ctx.beginPath();
      if (this.ctx.roundRect) {
        this.ctx.roundRect(px, py, pw, ph, 4);
      } else {
        this.ctx.rect(px, py, pw, ph);
      }
      this.ctx.fill();
      this.ctx.stroke();

      // Ojos planos
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(px + pw * 0.3, py + ph * 0.4, 2.5, 0, Math.PI * 2);
      this.ctx.arc(px + pw * 0.7, py + ph * 0.4, 2.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Pupilas
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(px + pw * 0.3, py + ph * 0.4, 1.0, 0, Math.PI * 2);
      this.ctx.arc(px + pw * 0.7, py + ph * 0.4, 1.0, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw cosmetic icon above the player if equipped
      if (player.cosmeticIcon) {
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(player.cosmeticIcon, px + pw / 2, py - 18);
      }

      // Mostrar nombre de usuario (si existe) en lugar del id
      const displayName = player.username || (playerId || '').substring(0, 6);
      this.ctx.fillStyle = this.dayNight === 'DAY' ? '#1c2d37' : '#ffffff';
      this.ctx.font = 'bold 11px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(displayName, px + pw / 2, py - (player.cosmeticIcon ? 30 : 8));

      // Mostrar contador de recursos
      const count = this.resourcesCollected[playerId] || 0;
      this.ctx.font = '9px Arial';
      this.ctx.fillText(
        `📦 ${count}`,
        px + pw / 2,
        py + ph + 12
      );
    }

    /*
    |--------------------------------------------------------------------------
    | INFORMACIÓN DEL JUGADOR ACTUAL (ESQUINA SUPERIOR)
    |--------------------------------------------------------------------------
    */
    if (this.playerId) {
      const myPlayer = this.players && this.players[this.playerId];
      const myName = myPlayer && myPlayer.username ? myPlayer.username : (this.playerId || '').substring(0, 8);
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = this.dayNight === 'DAY' ? '#1c2d37' : '#7fffd4';
      this.ctx.font = 'bold 13px Arial';
      this.ctx.fillText(`Jugador: ${myName}`, 15, 25);

      const myCount = this.resourcesCollected[this.playerId] || 0;
      this.ctx.fillText(`Madera: ${myCount}`, 15, 43);
    }

    this.drawScoreboard();
  }

  private drawScoreboard(): void {
    const canvas = this.canvasRef.nativeElement;
    const padding = 10;
    const boxWidth = 160;
    const playersArray = Object.values(this.players || {});
    const rowHeight = 20;
    const boxHeight = Math.max(40, playersArray.length * rowHeight + 30);
    const x = canvas.width - boxWidth - padding;
    const y = padding;

    // Caja de puntuación plana estilo UI moderna
    this.ctx.fillStyle = 'rgba(35, 50, 60, 0.85)';
    this.ctx.fillRect(x, y, boxWidth, boxHeight);
    this.ctx.strokeStyle = '#2e414e';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(x, y, boxWidth, boxHeight);

    this.ctx.fillStyle = '#7fffd4';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Tabla de Puntuación', x + 10, y + 18);

    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.font = '11px Arial';
    playersArray.forEach((p: any, i: number) => {
      const display = p && p.username ? p.username : ((p && p.id) ? (p.id || '').substring(0, 6) : '---');
      const text = `${display}: ${p.score || 0} pts`;
      this.ctx.fillText(text, x + 10, y + 36 + i * rowHeight);
    });
  }

  private drawFire(): void {
    const maxIntensity = this.fire.maxIntensity || 100;
    const fraction = Math.max(0, Math.min(1, (this.fire.intensity || 0) / maxIntensity));
    const visibleRadius = Math.max(8, (this.fire.radius || 70) * fraction);

    if ((this.fire.intensity || 0) <= 0) {
      // Dibujar cenizas (tocón apagado plano)
      this.ctx.beginPath();
      this.ctx.fillStyle = '#2f3640';
      this.ctx.arc(this.fire.x, this.fire.y, 22, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.fillStyle = '#1e272e';
      this.ctx.arc(this.fire.x, this.fire.y, 10, 0, Math.PI * 2);
      this.ctx.fill();
      return;
    }

    // Halo plano exterior (baja opacidad)
    this.ctx.beginPath();
    this.ctx.arc(this.fire.x, this.fire.y, visibleRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(255, 159, 67, ${0.15 * fraction})`;
    this.ctx.fill();

    // Halo plano intermedio (mediana opacidad)
    this.ctx.beginPath();
    this.ctx.arc(this.fire.x, this.fire.y, visibleRadius * 0.6, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(255, 94, 87, ${0.35 * fraction})`;
    this.ctx.fill();

    // Troncos de madera planos cruzados
    this.ctx.fillStyle = '#8d6e63';
    this.ctx.fillRect(this.fire.x - 18, this.fire.y - 3, 36, 6);
    this.ctx.fillRect(this.fire.x - 3, this.fire.y - 18, 6, 36);

    // Núcleo plano (color amarillo sólido)
    this.ctx.beginPath();
    this.ctx.arc(this.fire.x, this.fire.y, Math.max(6, 14 * fraction), 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffdd59';
    this.ctx.fill();
  }

  private drawEnemies(): void {
    if (!this.enemies || this.enemies.length === 0) return;

    this.enemies.forEach((e: any) => {
      // Only render visible enemies (visible property from server)
      if (!e.visible) return;
      
      const ex = e.x;
      const ey = e.y;
      const r = 12;
      const behavior = e.behaviorType || getEnemyBehaviorType(e, this.roomDifficulty);
      const color = behavior === 'ambusher' ? '#ff5f7d' : '#5f27cd';

      // Cuerpo plano morado oscuro
      this.ctx.beginPath();
      this.ctx.fillStyle = color;
      this.ctx.arc(ex, ey, r, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = '#1e272e';
      this.ctx.stroke();

      // Ojos enojados (líneas diagonales de color amarillo para que se vean en todos los enemigos)
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 2.5;

      // Ojo izquierdo
      this.ctx.beginPath();
      this.ctx.moveTo(ex - 6, ey - 3);
      this.ctx.lineTo(ex - 2, ey + 1);
      this.ctx.stroke();

      // Ojo derecho
      this.ctx.beginPath();
      this.ctx.moveTo(ex + 6, ey - 3);
      this.ctx.lineTo(ex + 2, ey + 1);
      this.ctx.stroke();
    });
  }
}



