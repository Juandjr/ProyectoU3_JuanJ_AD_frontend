import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Socket, io } from 'socket.io-client';
import { Observable } from 'rxjs';
import { clearJwt, isJwtExpiringSoon, isJwtValid } from '../utils/auth-utils';
import { getBackendBaseUrl } from '../utils/backend-config';

@Injectable({
  providedIn: 'root'
})
export class GameSocketService {

  private socket!: Socket;
  private connected = false;
  private refreshTimerId: number | null = null;
  private currentToken: string | null = null;
  private currentBaseUrl: string | null = null;
  private router = inject(Router);

  connect(): void {
    const token = localStorage.getItem('jwt');
    if (!isJwtValid(token)) {
      clearJwt();
      this.disconnect();
      this.router.navigate(['/login']);
      return;
    }

    const url = getBackendBaseUrl();

    if (this.socket && this.socket.connected && this.currentToken === token && this.currentBaseUrl === url) {
      return;
    }

    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(url, { auth: { token } });
    this.currentToken = token;
    this.currentBaseUrl = url;
    this.connected = true;

    this.socket.on('connect', () => {
      this.startTokenRefreshLoop();
    });

    this.socket.on('disconnect', () => {
      this.stopTokenRefreshLoop();
    });

    this.socket.on('connect_error', (err: any) => {
      if (err && err.message && err.message.toLowerCase().includes('authentication')) {
        clearJwt();
        this.disconnect();
        this.router.navigate(['/login']);
      }
    });
  }

  isConnected(): boolean {
    return !!(this.socket && this.socket.connected);
  }

  getSocketId(): string {
    return this.socket?.id || '';
  }

  getRawSocket(): Socket | null {
    return this.socket || null;
  }

  getRooms(): Promise<any[]> {
    return new Promise((resolve) => {
      if (!this.socket) this.connect();
      this.socket.emit('getRooms', (rooms: any[]) => {
        resolve(rooms || []);
      });
    });
  }

  createRoom(name: string, maxPlayers: number, password?: string, difficulty?: string): Promise<any> {
    return new Promise((resolve) => {
      if (!this.socket) this.connect();
      this.socket.emit('createRoom', { name, maxPlayers, password: password || '', difficulty: difficulty || 'MEDIUM' }, (res: any) => {
        resolve(res);
      });
    });
  }

  joinRoom(roomId: string, password?: string): Promise<any> {
    return new Promise((resolve) => {
      if (!this.socket) this.connect();
      this.socket.emit('joinRoom', { roomId, password: password || '' }, (res: any) => {
        resolve(res);
      });
    });
  }

  leaveRoom(): void {
    if (this.socket) {
      this.socket.emit('leaveRoom');
    }
  }

  onRoomsUpdated(): Observable<any[]> {
    return new Observable(observer => {
      if (!this.socket) this.connect();
      const handler = (rooms: any) => observer.next(rooms);
      this.socket.on('roomsUpdated', handler);
      return () => { this.socket.off('roomsUpdated', handler); };
    });
  }

  sendPlayerPosition(x: number, y: number): void {
    if (this.socket) {
      this.socket.emit('playerMove', { x, y });
    }
  }

  sendResourceCollected(resourceId: any): void {
    if (this.socket) {
      this.socket.emit('resourceCollected', { resourceId });
    }
  }

  sendDepositResources(): void {
    if (this.socket) {
      this.socket.emit('depositResources');
    }
  }

  onPlayersUpdated(): Observable<any> {
    return new Observable(observer => {
      const handler = (players: any) => observer.next(players);
      this.socket.on('playersUpdated', handler);
      return () => { this.socket.off('playersUpdated', handler); };
    });
  }

  onResourceCreated(): Observable<any> {
    return new Observable(observer => {
      const handler = (resource: any) => observer.next(resource);
      this.socket.on('resourceCreated', handler);
      return () => { this.socket.off('resourceCreated', handler); };
    });
  }

  onResourceCollected(): Observable<any> {
    return new Observable(observer => {
      const handler = (data: any) => observer.next(data);
      this.socket.on('resourceCollected', handler);
      return () => { this.socket.off('resourceCollected', handler); };
    });
  }

  onDayNightChanged(): Observable<any> {
    return new Observable(observer => {
      const handler = (state: any) => observer.next(state);
      this.socket.on('dayNightChanged', handler);
      return () => { this.socket.off('dayNightChanged', handler); };
    });
  }

  onFireUpdated(): Observable<any> {
    return new Observable(observer => {
      const handler = (fire: any) => observer.next(fire);
      this.socket.on('fireUpdated', handler);
      return () => { this.socket.off('fireUpdated', handler); };
    });
  }

  onEnemiesUpdated(): Observable<any> {
    return new Observable(observer => {
      const handler = (enemies: any) => observer.next(enemies);
      this.socket.on('enemiesUpdated', handler);
      return () => { this.socket.off('enemiesUpdated', handler); };
    });
  }

  onInitialState(): Observable<any> {
    return new Observable(observer => {
      const handler = (state: any) => observer.next(state);
      this.socket.on('initialWorldState', handler);
      return () => { this.socket.off('initialWorldState', handler); };
    });
  }

  requestInitialWorldState(): void {
    if (this.socket) {
      this.socket.emit('requestInitialWorldState');
    }
  }

  onForceDisconnect(): Observable<any> {
    return new Observable(observer => {
      const handler = (data: any) => observer.next(data);
      this.socket.on('forceDisconnect', handler);
      return () => { this.socket.off('forceDisconnect', handler); };
    });
  }

  private async refreshToken(): Promise<boolean> {
    const token = localStorage.getItem('jwt');
    if (!token) return false;
    const url = getBackendBaseUrl();

    try {
      const res = await fetch(`${url}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      if (data.token) {
        localStorage.setItem('jwt', data.token);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    const token = localStorage.getItem('jwt');
    if (!token) return;
    if (isJwtExpiringSoon(token, 5 * 60 * 1000)) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        clearJwt();
        this.router.navigate(['/login']);
      }
    }
  }

  private startTokenRefreshLoop(): void {
    this.stopTokenRefreshLoop();
    this.refreshTokenIfNeeded();
    this.refreshTimerId = window.setInterval(() => {
      this.refreshTokenIfNeeded();
    }, 60 * 1000);
  }

  private stopTokenRefreshLoop(): void {
    if (this.refreshTimerId !== null) {
      window.clearInterval(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  notifyPlayerDeath(): void {
    if (this.socket) {
      this.socket.emit('playerDied');
    }
  }

  submitResult(score: number, difficulty: string = 'MEDIUM'): Promise<any> {
    const token = localStorage.getItem('jwt');
    const url = getBackendBaseUrl();
    return fetch(`${url}/api/scoreboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ score, difficulty })
    }).then(res => {
      if (!res.ok) return res.json().then(err => { throw new Error(err && err.error ? err.error : 'Failed to submit result'); });
      return res.json();
    });
  }

  disconnect(): void {
    if (this.socket) {
      try { this.socket.disconnect(); } catch (e) { /* ignore */ }
      this.socket = undefined as any;
      this.currentToken = null;
      this.currentBaseUrl = null;
      this.connected = false;
      this.stopTokenRefreshLoop();
    }
  }
}
