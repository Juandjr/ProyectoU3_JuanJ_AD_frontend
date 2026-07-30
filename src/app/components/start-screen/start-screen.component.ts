import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameSocketService } from '../../services/game-socket.service';

@Component({
  selector: 'app-start-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './start-screen.component.html',
  styleUrl: './start-screen.component.css'
})
export class StartScreenComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private gameSocket = inject(GameSocketService);
  private cdr = inject(ChangeDetectorRef);

  rooms: any[] = [];
  showCreateModal = false;
  newRoomName = '';
  newRoomMax = 4;
  newRoomPassword = '';
  newRoomDifficulty = 'MEDIUM';
  alertMsg = '';
  isJoining = false;

  // Password modal for joining protected rooms
  showPasswordModal = false;
  joinPasswordInput = '';
  pendingJoinRoomId = '';

  private roomsSub!: Subscription;

  async ngOnInit() {
    this.gameSocket.connect();
    
    // Subscribe to live room updates
    this.roomsSub = this.gameSocket.onRoomsUpdated().subscribe(rooms => {
      this.rooms = rooms || [];
      this.cdr.detectChanges();
    });

    // Fetch initial list
    this.rooms = await this.gameSocket.getRooms();
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    if (this.roomsSub) {
      this.roomsSub.unsubscribe();
    }
  }

  onJoinClick(room: any) {
    if (this.isJoining) return;

    // If room has a password, show password modal
    if (room.hasPassword) {
      this.pendingJoinRoomId = room.id;
      this.joinPasswordInput = '';
      this.showPasswordModal = true;
      this.cdr.detectChanges();
      return;
    }

    // Public/unprotected room — join directly
    this.joinRoom(room.id);
  }

  async onConfirmJoinPassword() {
    if (!this.joinPasswordInput.trim()) {
      this.showAlert('Ingresa la contraseña de la sala');
      return;
    }
    this.showPasswordModal = false;
    await this.joinRoom(this.pendingJoinRoomId, this.joinPasswordInput.trim());
    this.joinPasswordInput = '';
    this.pendingJoinRoomId = '';
  }

  onCancelJoinPassword() {
    this.showPasswordModal = false;
    this.joinPasswordInput = '';
    this.pendingJoinRoomId = '';
    this.cdr.detectChanges();
  }

  async joinRoom(roomId: string, password?: string) {
    if (this.isJoining) return;
    this.isJoining = true;

    try {
      const res = await this.gameSocket.joinRoom(roomId, password);
      if (res && res.success) {
        this.router.navigate(['/game'], {
          queryParams: {
            roomId: res.roomId,
            difficulty: res.difficulty || 'MEDIUM'
          }
        });
      } else {
        this.showAlert(res?.error || 'No se pudo ingresar a la sala');
      }
    } catch (e: any) {
      this.showAlert(e.message || 'Error ingresando a la sala');
    } finally {
      this.isJoining = false;
      this.cdr.detectChanges();
    }
  }

  async onCreateRoom() {
    if (!this.newRoomName.trim()) {
      this.showAlert('Ingresa un nombre para la sala');
      return;
    }
    if (this.newRoomMax < 2 || this.newRoomMax > 6) {
      this.showAlert('El máximo de jugadores debe ser entre 2 y 6');
      return;
    }

    this.isJoining = true;
    try {
      const res = await this.gameSocket.createRoom(
        this.newRoomName.trim(),
        this.newRoomMax,
        this.newRoomPassword.trim() || undefined,
        this.newRoomDifficulty
      );
      if (res && res.success) {
        this.showCreateModal = false;
        // Join with the same password used to create
        await this.joinRoom(res.roomId, this.newRoomPassword.trim() || undefined);
        this.newRoomName = '';
        this.newRoomPassword = '';
        this.newRoomMax = 4;
        this.newRoomDifficulty = 'MEDIUM';
      } else {
        this.showAlert(res?.error || 'Error al crear la sala');
      }
    } catch (e: any) {
      this.showAlert(e.message || 'Error al crear la sala');
    } finally {
      this.isJoining = false;
      this.cdr.detectChanges();
    }
  }

  onViewLeaderboard(): void {
    this.router.navigate(['/scoreboard']);
  }

  showAlert(msg: string) {
    this.alertMsg = msg;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.alertMsg = '';
      this.cdr.detectChanges();
    }, 4000);
  }
}
