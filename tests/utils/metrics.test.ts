import { metrics } from '../../src/utils/metrics';

describe('Metrics', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('Counter operations', () => {
    test('should increment counter with default value 1', () => {
      metrics.incrementCounter('test_counter');
      expect(metrics.getCounter('test_counter')).toBe(1);
    });

    test('should increment counter with custom value', () => {
      metrics.incrementCounter('test_counter', 5);
      expect(metrics.getCounter('test_counter')).toBe(5);
    });

    test('should accumulate counter increments', () => {
      metrics.incrementCounter('test_counter', 3);
      metrics.incrementCounter('test_counter', 2);
      expect(metrics.getCounter('test_counter')).toBe(5);
    });

    test('should return 0 for non-existent counter', () => {
      expect(metrics.getCounter('non_existent')).toBe(0);
    });
  });

  describe('Gauge operations', () => {
    test('should set and get gauge value', () => {
      metrics.setGauge('test_gauge', 42);
      expect(metrics.getGauge('test_gauge')).toBe(42);
    });

    test('should overwrite gauge value', () => {
      metrics.setGauge('test_gauge', 42);
      metrics.setGauge('test_gauge', 100);
      expect(metrics.getGauge('test_gauge')).toBe(100);
    });

    test('should return undefined for non-existent gauge', () => {
      expect(metrics.getGauge('non_existent')).toBeUndefined();
    });
  });

  describe('Histogram operations', () => {
    test('should record histogram values', () => {
      metrics.recordHistogram('test_histogram', 10);
      metrics.recordHistogram('test_histogram', 20);
      metrics.recordHistogram('test_histogram', 30);

      const stats = metrics.getHistogramStats('test_histogram');
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(3);
      expect(stats?.avg).toBe(20);
      expect(stats?.min).toBe(10);
      expect(stats?.max).toBe(30);
    });

    test('should calculate percentiles correctly', () => {
      // Add 100 values: 1, 2, 3, ..., 100
      for (let i = 1; i <= 100; i++) {
        metrics.recordHistogram('test_histogram', i);
      }

      const stats = metrics.getHistogramStats('test_histogram');
      expect(stats?.count).toBe(100);
      expect(stats?.p95).toBe(96); // p95 of 1-100 is Math.floor(100 * 0.95) = 95th index, which is value 96
    });

    test('should return null for non-existent histogram', () => {
      expect(metrics.getHistogramStats('non_existent')).toBeNull();
    });

    test('should limit histogram entries to 1000', () => {
      // Add 1500 entries
      for (let i = 1; i <= 1500; i++) {
        metrics.recordHistogram('test_histogram', i);
      }

      const stats = metrics.getHistogramStats('test_histogram');
      expect(stats?.count).toBe(1000);
      // Should have kept the last 1000 entries (501-1500)
      expect(stats?.min).toBe(501);
      expect(stats?.max).toBe(1500);
    });
  });

  describe('getAllMetrics', () => {
    test('should return all metrics in correct format', () => {
      metrics.incrementCounter('requests_total', 10);
      metrics.setGauge('active_connections', 5);
      metrics.recordHistogram('response_time', 100);
      metrics.recordHistogram('response_time', 200);

      const allMetrics = metrics.getAllMetrics();

      expect(allMetrics).toHaveProperty('counters');
      expect(allMetrics).toHaveProperty('gauges');
      expect(allMetrics).toHaveProperty('histograms');

      expect(allMetrics.counters.requests_total).toBe(10);
      expect(allMetrics.gauges.active_connections).toBe(5);
      expect(allMetrics.histograms.response_time).toEqual({
        count: 2,
        avg: 150,
        min: 100,
        max: 200,
        p95: 200,
      });
    });

    test('should return empty objects when no metrics exist', () => {
      const allMetrics = metrics.getAllMetrics();

      expect(allMetrics.counters).toEqual({});
      expect(allMetrics.gauges).toEqual({});
      expect(allMetrics.histograms).toEqual({});
    });
  });

  describe('reset', () => {
    test('should clear all metrics', () => {
      metrics.incrementCounter('test_counter', 5);
      metrics.setGauge('test_gauge', 10);
      metrics.recordHistogram('test_histogram', 15);

      metrics.reset();

      expect(metrics.getCounter('test_counter')).toBe(0);
      expect(metrics.getGauge('test_gauge')).toBeUndefined();
      expect(metrics.getHistogramStats('test_histogram')).toBeNull();
    });
  });
});
