import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import { GameSocketService } from './game-socket.service';

export type LatencyEnvironment = 'local' | 'produccion';

export interface LatencySample {
  sequence: number;
  sentAt: number;
  receivedAt: number | null;
  rttMs: number | null;
  status: 'ok' | 'timeout' | 'disconnected' | 'reconnected';
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
  interruptedSamples: number;
  config: {
    totalPings: number;
    intervalMs: number;
    timeoutMs: number;
  };
  summary: string;
  aborted: boolean;
  abortReason: string | null;
}

@Injectable({ providedIn: 'root' })
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
    let sawDisconnect = false;
    let lastDisconnectReason: string | null = null;

    for (let sequence = 1; sequence <= totalPings; sequence += 1) {
      let socket = this.gameSocket.getRawSocket();

      if (!socket || !socket.connected) {
        sawDisconnect = true;
        lastDisconnectReason = 'Socket desconectado antes de iniciar la siguiente muestra.';
        console.warn('[LatencyTest] ' + lastDisconnectReason);

        this.gameSocket.connect();
        socket = this.gameSocket.getRawSocket();

        if (!socket || !socket.connected) {
          samples.push({
            sequence,
            sentAt: performance.now(),
            receivedAt: null,
            rttMs: null,
            status: 'disconnected'
          });

          if (sequence < totalPings && intervalMs > 0) {
            await this.sleep(intervalMs);
          }
          continue;
        }

        samples.push({
          sequence,
          sentAt: performance.now(),
          receivedAt: performance.now(),
          rttMs: 0,
          status: 'reconnected'
        });
      }

      try {
        const sentAt = performance.now();
        await this.sendPing(socket, sequence, sentAt, timeoutMs);
        const receivedAt = performance.now();

        samples.push({
          sequence,
          sentAt,
          receivedAt,
          rttMs: receivedAt - sentAt,
          status: 'ok'
        });
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

        sawDisconnect = sawDisconnect || isDisconnect;
        lastDisconnectReason = isDisconnect
          ? `La conexion se cerró durante la prueba: ${message}`
          : `Timeout esperando pongTest: ${message}`;

        if (isDisconnect) {
          console.warn('[LatencyTest] Socket desconectado durante la medición.', { message });
        }

        this.gameSocket.disconnect();
        this.gameSocket.connect();
      }

      if (sequence < totalPings && intervalMs > 0) {
        await this.sleep(intervalMs);
      }
    }

    const statistics = this.calculateStatistics(samples);
    const interruptedSamples = samples.filter(sample => sample.status !== 'ok').length;
    const result: LatencyTestResult = {
      environment,
      isoDate: new Date().toISOString(),
      samples,
      statistics,
      interruptedSamples,
      config: { totalPings, intervalMs, timeoutMs },
      summary: this.buildSummary(environment, statistics, samples, sawDisconnect, lastDisconnectReason),
      aborted: sawDisconnect,
      abortReason: lastDisconnectReason
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

  exportResultAsPdf(result: LatencyTestResult): void {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    doc.setTextColor(20, 28, 38);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Latency Report - Socket.io', margin, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${result.isoDate}`, margin, 23);

    let y = 38;
    doc.setTextColor(20, 28, 38);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen ejecutivo', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');

    const summaryLines = [
      `Entorno: ${result.environment}`,
      `Muestras válidas: ${result.statistics.count}/${result.samples.length}`,
      `Muestras interrumpidas: ${result.interruptedSamples}`,
      `Promedio: ${result.statistics.average} ms`,
      `Mediana: ${result.statistics.median} ms`,
      `P95: ${result.statistics.p95} ms`,
      `Desviación estándar: ${result.statistics.stdDev} ms`,
      `Mínimo: ${result.statistics.min} ms`,
      `Máximo: ${result.statistics.max} ms`
    ];

    summaryLines.forEach(line => {
      doc.text(`- ${line}`, margin, y);
      y += 5.6;
    });

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Gráfica de RTT por muestra', margin, y);
    y += 5;
    this.drawRttChart(doc, result, margin, y, pageWidth - margin * 2, 62);
    y += 72;

    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const note = result.aborted && result.abortReason
      ? `La medición terminó con eventos de conexión intermitente: ${result.abortReason}`
      : 'La medición terminó correctamente sin interrupciones.';
    doc.text(this.wrapText(note, 90), margin, y);

    const fileName = `latency-${result.environment}-${this.toFileNameStamp(result.isoDate)}.pdf`;
    doc.save(fileName);
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
    hadDisconnect: boolean,
    abortReason: string | null
  ): string {
    const okCount = samples.filter(sample => sample.status === 'ok').length;
    const interruptedCount = samples.filter(sample => sample.status !== 'ok').length;
    return [
      `[LatencyTest] Entorno: ${environment}`,
      `[LatencyTest] Muestras válidas: ${okCount}/${samples.length}`,
      `[LatencyTest] Muestras interrumpidas: ${interruptedCount}`,
      `[LatencyTest] Promedio: ${statistics.average} ms`,
      `[LatencyTest] Mediana: ${statistics.median} ms`,
      `[LatencyTest] P95: ${statistics.p95} ms`,
      `[LatencyTest] Desviación estándar: ${statistics.stdDev} ms`,
      `[LatencyTest] Mínimo: ${statistics.min} ms`,
      `[LatencyTest] Máximo: ${statistics.max} ms`,
      hadDisconnect && abortReason ? `[LatencyTest] Se detectaron eventos de conexión: ${abortReason}` : '[LatencyTest] Prueba completada correctamente.'
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

  private drawRttChart(doc: jsPDF, result: LatencyTestResult, x: number, y: number, width: number, height: number): void {
    const values = result.samples
      .filter(sample => typeof sample.rttMs === 'number')
      .map(sample => sample.rttMs as number);

    doc.setDrawColor(210, 218, 230);
    doc.setLineWidth(0.2);
    doc.rect(x, y, width, height);

    if (values.length === 0) {
      doc.text('No hay muestras válidas para graficar.', x + 4, y + 10);
      return;
    }

    const max = Math.max(...values);
    const min = Math.min(...values);
    const plotHeight = height - 10;
    const plotWidth = width - 8;
    const barGap = 1;
    const visibleValues = values.slice(0, 40);
    const barWidth = Math.max(1, plotWidth / Math.min(visibleValues.length, 40) - barGap);
    const originX = x + 4;
    const originY = y + height - 4;

    doc.setFontSize(7);
    doc.setTextColor(90, 99, 112);
    doc.text(`min ${this.round(min)} ms`, x + 4, y + 6);
    doc.text(`max ${this.round(max)} ms`, x + width - 24, y + 6);

    visibleValues.forEach((value, index) => {
      const normalized = max === 0 ? 0 : value / max;
      const barHeight = Math.max(1, normalized * plotHeight);
      const barX = originX + index * (barWidth + barGap);
      const barY = originY - barHeight;
      doc.setFillColor(125, 211, 252);
      doc.rect(barX, barY, barWidth, barHeight, 'F');
    });
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    words.forEach(word => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });

    if (current) lines.push(current);
    return lines;
  }
}
