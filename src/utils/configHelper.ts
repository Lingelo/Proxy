import { config } from '../config';

export function displayConfigurationSummary(): void {
  console.log('🚀 Proxy Configuration:');
  console.log(`   📡 Targets: ${config.targets.length} configured`);
  config.targets.forEach((target, index) => {
    console.log(`      ${index + 1}. ${target}`);
  });
  console.log(`   ⏱️  Timeout: ${config.timeout}ms`);
  console.log(`   🌐 Server: ${config.host}:${config.port}`);
  console.log(`   📝 Log Level: ${config.logLevel}`);
  console.log('');
}

export function validateRuntimeConfiguration(): string[] {
  const warnings: string[] = [];

  // Check for common misconfigurations
  if (config.targets.length === 1) {
    warnings.push('⚠️  Only one target configured - no load balancing benefits');
  }

  if (config.timeout < 1000) {
    warnings.push('⚠️  Very low timeout (<1s) may cause false negatives in health checks');
  }

  if (config.timeout > 10000) {
    warnings.push('⚠️  High timeout (>10s) may impact request latency');
  }

  if (config.host === '127.0.0.1') {
    warnings.push("⚠️  Host set to localhost - proxy won't be accessible externally");
  }

  // Check for potential port conflicts
  const proxyPort = config.port;
  const targetPorts = config.targets.map(target => {
    const [, port] = target.split(':');
    return parseInt(port, 10);
  });

  if (targetPorts.includes(proxyPort)) {
    warnings.push(`⚠️  Proxy port ${proxyPort} conflicts with target port - may cause issues`);
  }

  return warnings;
}
