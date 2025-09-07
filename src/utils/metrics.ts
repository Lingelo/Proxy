interface MetricEntry {
  timestamp: number;
  value: number;
}

class Metrics {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, MetricEntry[]> = new Map();
  private gauges: Map<string, number> = new Map();

  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  recordHistogram(name: string, value: number): void {
    const entries = this.histograms.get(name) || [];
    entries.push({ timestamp: Date.now(), value });

    // Keep only last 1000 entries to prevent memory leaks
    if (entries.length > 1000) {
      entries.shift();
    }

    this.histograms.set(name, entries);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  getGauge(name: string): number | undefined {
    return this.gauges.get(name);
  }

  getHistogramStats(
    name: string
  ): { count: number; avg: number; min: number; max: number; p95: number } | null {
    const entries = this.histograms.get(name);
    if (!entries || entries.length === 0) return null;

    const values = entries.map(e => e.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = values[0];
    const max = values[count - 1];
    const p95Index = Math.floor(count * 0.95);
    const p95 = values[p95Index];

    return { count, avg, min, max, p95 };
  }

  getAllMetrics() {
    const result: any = {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: {},
    };

    for (const [name] of this.histograms) {
      result.histograms[name] = this.getHistogramStats(name);
    }

    return result;
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

export const metrics = new Metrics();
