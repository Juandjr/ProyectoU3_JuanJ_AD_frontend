import { Injectable, inject } from '@angular/core';
import { GameSocketService } from './game-socket.service';

export type LatencyEnvironment = 'local' | 'produccion';

export interface LatencySample {
  sequence: number;
  sentAt: number;
  receivedAt: number | null;
  rttMs: number | null;
  status: 'ok' | 'timeout' | 'disconnected' | 'aborted';
}

export interface LatencyStatistics {
  count: number;
  average: number;
  median: number;
  p95: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface LatencyTestResult {
  environment: LatencyEnvironment;
  isoDate: string;
  samples: LatencySample[];
  statistics: LatencyStatistics;
  config: {
    totalPings: number;
    intervalMs: number;
    timeoutMs: number;
  };
  summary: string;
  aborted: boolean;
  abortReason: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class LatencyLoggerService {
  private readonly gameSocket = inject(GameSocketService);

  async runLatencyTest(options?: {
    totalPings?: number;
    intervalMs?: number;
    timeoutMs?: number;
    environment?: LatencyEnvironment;
  }): Promise<LatencyTestResult> {
    const totalPings = Math.max(1, Math.floor(options?.totalPings ?? 100));
    const intervalMs = Math.max(0, Math.floor(options?.intervalMs ?? 200));
    const timeoutMs = Math.max(250, Math.floor(options?.timeoutMs ?? 5000));
    const environment = options?.environment ?? this.detectEnvironment();

    this.gameSocket.connect();

    const samples: LatencySample[] = [];
    let aborted = false;
    let abortReason: string | null = null;

    for (let sequence = 1; sequence <= totalPings; sequence += 1) {
      const socket = this.gameSocket.getRawSocket();
      if (!socket || !socket.connected) {
        aborted = true;
        abortReason = 'Socket desconectado antes de iniciar la siguiente muestra.';
        break;
      }

      try {
        const sentAt = performance.now();
        const response = await this.sendPing(socket, sequence, sentAt, timeoutMs);
        const receivedAt = performance.now();

        samples.push({
          sequence,
          sentAt,
          receivedAt,
          rttMs: receivedAt - sentAt,
          status: 'ok'
        });

        // The echoed payload is intentionally transparent; RTT is measured locally.
      } catch (err: any) {
        const message = String(err?.message || err || '');
        const isDisconnect = message.toLowerCase().includes('disconnect') || message.toLowerCase().includes('transport close');

        samples.push({
          sequence,
          sentAt: performance.now(),
          receivedAt: null,
          rttMs: null,
          status: isDisconnect ? 'disconnected' : 'timeout'
        });

        aborted = isDisconnect;
        abortReason = isDisconnect
          ? `La conexión se cerró durante la prueba: ${message}`
          : `Timeout esperando pongTest: ${message}`;

        if (isDisconnect) {
          console.warn('[LatencyTest] Socket desconectado durante la medición.', { message });
          break;
        }
      }

      if (sequence < totalPings && intervalMs > 0) {
        await this.sleep(intervalMs);
      }
    }

    const statistics = this.calculateStatistics(samples);
    const result: LatencyTestResult = {
      environment,
      isoDate: new Date().toISOString(),
      samples,
      statistics,
      config: { totalPings, intervalMs, timeoutMs },
      summary: this.buildSummary(environment, statistics, samples, aborted, abortReason),
      aborted,
      abortReason
    };

    this.printSummary(result);
    return result;
  }

  exportResultAsJson(result: LatencyTestResult): void {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json;charset=utf-8' });
    const fileName = `latency-${result.environment}-${this.toFileNameStamp(result.isoDate)}.json`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private sendPing(socket: any, sequence: number, sentAt: number, timeoutMs: number): Promise<{ sequence: number; clientTimestamp: number }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`ping ${sequence} excedió ${timeoutMs} ms`));
      }, timeoutMs);

      const onDisconnect = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Socket disconnected'));
      };

      const cleanup = () => {
        window.clearTimeout(timer);
        socket.off('disconnect', onDisconnect);
      };

      socket.on('disconnect', onDisconnect);
      socket.emit('pingTest', { sequence, clientTimestamp: sentAt }, (payload: { sequence: number; clientTimestamp: number }) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(payload);
      });
    });
  }

  private calculateStatistics(samples: LatencySample[]): LatencyStatistics {
    const values = samples
      .filter(sample => typeof sample.rttMs === 'number' && Number.isFinite(sample.rttMs))
      .map(sample => sample.rttMs as number)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return { count: 0, average: 0, median: 0, p95: 0, stdDev: 0, min: 0, max: 0 };
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    const average = sum / values.length;
    const median = this.percentile(values, 50);
    const p95 = this.percentile(values, 95);
    const variance = values.reduce((acc, value) => acc + ((value - average) ** 2), 0) / values.length;

    return {
      count: values.length,
      average: this.round(average),
      median: this.round(median),
      p95: this.round(p95),
      stdDev: this.round(Math.sqrt(variance)),
      min: this.round(values[0]),
      max: this.round(values[values.length - 1])
    };
  }

  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 1) return sortedValues[0];
    const rank = (percentile / 100) * (sortedValues.length - 1);
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    if (low === high) return sortedValues[low];
    const weight = rank - low;
    return sortedValues[low] * (1 - weight) + sortedValues[high] * weight;
  }

  private buildSummary(
    environment: LatencyEnvironment,
    statistics: LatencyStatistics,
    samples: LatencySample[],
    aborted: boolean,
    abortReason: string | null
  ): string {
    const okCount = samples.filter(sample => sample.status === 'ok').length;
    return [
      `[LatencyTest] Entorno: ${environment}`,
      `[LatencyTest] Muestras válidas: ${okCount}/${samples.length}`,
      `[LatencyTest] Promedio: ${statistics.average} ms`,
      `[LatencyTest] Mediana: ${statistics.median} ms`,
      `[LatencyTest] P95: ${statistics.p95} ms`,
      `[LatencyTest] Desviación estándar: ${statistics.stdDev} ms`,
      `[LatencyTest] Mínimo: ${statistics.min} ms`,
      `[LatencyTest] Máximo: ${statistics.max} ms`,
      aborted && abortReason ? `[LatencyTest] Prueba detenida: ${abortReason}` : '[LatencyTest] Prueba completada correctamente.'
    ].join('\n');
  }

  private printSummary(result: LatencyTestResult): void {
    console.log(result.summary);
    console.table(result.samples.map(sample => ({
      sequence: sample.sequence,
      status: sample.status,
      rttMs: sample.rttMs
    })));
  }

  private detectEnvironment(): LatencyEnvironment {
    const host = window.location.hostname.toLowerCase();
    return (host === 'localhost' || host === '127.0.0.1') ? 'local' : 'produccion';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  private round(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  private toFileNameStamp(isoDate: string): string {
    return isoDate.replace(/[:.]/g, '-');
  }
}
