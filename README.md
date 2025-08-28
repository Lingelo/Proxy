# 🚀 Smart HTTP Proxy

Un proxy HTTP intelligent avec load balancing automatique, monitoring avancé et observabilité complète.

## ✨ Fonctionnalités

- **🔄 Load Balancing Intelligent** : Distribution automatique des requêtes vers les serveurs sains
- **🏥 Health Checks** : Vérifications périodiques de la santé des targets en arrière-plan
- **📊 Métriques & Monitoring** : Endpoints `/health` et `/metrics` pour l'observabilité
- **📝 Logs Structurés** : Correlation des requêtes avec IDs uniques
- **⚡ Performance Optimisée** : Pas de vérification synchrone, sélection des targets saines uniquement
- **🐳 Docker Ready** : Multi-stage builds, sécurité renforcée, 146MB seulement
- **⚙️ Configuration Flexible** : Validation automatique + variables d'environnement
- **🔧 CI/CD Complet** : GitHub Actions pour tests, builds et releases automatiques

## 🚦 Installation

### Avec Node.js

```bash
# Cloner le projet
git clone <repository-url>
cd proxy

# Installer les dépendances
yarn install

# Configurer l'environnement
cp .env-example .env
# Modifier .env avec vos targets

# Lancer en développement
yarn dev
```

### Avec Docker

```bash
# Production optimisé (146MB, sécurisé)
docker build -t smart-proxy .
docker run -p 7777:7777 -e TARGET_URLS="host1:3000|host2:3000" smart-proxy

# Développement avec hot-reload
docker-compose -f docker-compose.dev.yml up

# Stack complète avec services de test
docker-compose up

# Avec monitoring Prometheus + Grafana
docker-compose --profile monitoring up
```

## ⚙️ Configuration

Créez un fichier `.env` basé sur `.env-example` :

```env
# Liste des serveurs cibles (séparés par |)
TARGET_URLS=localhost:3000|localhost:3001|localhost:3002

# Timeout des health checks (ms)
TIMEOUT=5000

# Port du proxy
PORT=7777

# Adresse de binding
HOST=0.0.0.0

# Niveau de logs
LOG_LEVEL=info
```

## 🛠️ Utilisation

### Démarrage

```bash
# Mode développement (avec rechargement auto)
yarn dev

# Build et production
yarn build
node dist/index.js
```

### Endpoints de Monitoring

#### Health Check
```bash
curl http://localhost:7777/health
```

Réponse :
```json
{
  "status": "healthy",
  "details": {
    "healthy_targets": 2,
    "total_targets": 3,
    "targets": [
      {
        "url": "localhost:3000",
        "healthy": true,
        "responseTime": 45,
        "lastCheck": 1640995200000
      }
    ]
  }
}
```

#### Métriques
```bash
curl http://localhost:7777/metrics
```

Réponse :
```json
{
  "counters": {
    "proxy_requests_total": 1250,
    "proxy_errors_total": 3,
    "proxy_requests_by_target.localhost_3000": 625
  },
  "histograms": {
    "proxy_request_duration_ms": {
      "count": 1250,
      "avg": 125.5,
      "min": 15,
      "max": 2500,
      "p95": 450
    }
  },
  "gauges": {
    "proxy_healthy_targets": 2,
    "proxy_total_targets": 3
  },
  "uptime_seconds": 3600,
  "memory_usage": {...}
}
```

## 📊 Monitoring & Observabilité

### Métriques Collectées

**Compteurs** :
- `proxy_requests_total` : Nombre total de requêtes
- `proxy_errors_total` : Nombre d'erreurs du proxy
- `proxy_requests_by_target.*` : Requêtes par target
- `proxy_requests_failed_no_target` : Échecs par manque de target saine
- `proxy_requests_failed_error` : Échecs par erreur

**Histogrammes** :
- `proxy_request_duration_ms` : Durée des requêtes
- `proxy_target_response_time` : Temps de réponse des targets

**Gauges** :
- `proxy_healthy_targets` : Nombre de targets saines
- `proxy_total_targets` : Nombre total de targets

### Logs

Les logs sont écrits dans :
- **Console** : Format coloré et lisible
- **Fichier** : `logs/proxy.log` en format JSON structuré

Chaque requête possède un ID unique pour le tracing end-to-end.

## 🏗️ Architecture

```
src/
├── core/
│   ├── proxy.ts          # Serveur HTTP principal
│   └── monitoring.ts     # Health checks & endpoints
├── utils/
│   ├── metrics.ts        # Système de métriques
│   ├── logger.ts         # Logging structuré
│   └── requestId.ts      # IDs de corrélation
├── config.ts            # Configuration centralisée
└── index.ts            # Point d'entrée
```

## 🔄 Fonctionnement

1. **Démarrage** : Le proxy démarre les health checks en arrière-plan
2. **Health Checks** : Vérification toutes les 30s des targets configurées
3. **Requête entrante** : 
   - Génération d'un ID unique
   - Sélection aléatoire parmi les targets saines
   - Proxy de la requête
   - Collection des métriques
4. **Observabilité** : Logs corrélés et métriques temps réel

## 🐳 Déploiement Docker

Le Dockerfile inclus permet un déploiement simple :

```yaml
# docker-compose.yml exemple
version: '3.8'
services:
  proxy:
    build: .
    ports:
      - "7777:7777"
    environment:
      - TARGET_URLS=app1:3000|app2:3000|app3:3000
      - LOG_LEVEL=info
    volumes:
      - ./logs:/app/logs
```

## 📈 Monitoring en Production

Pour une utilisation en production, intégrez les endpoints avec :

- **Prometheus** : Scraping de `/metrics`
- **Grafana** : Visualisation des métriques
- **ELK Stack** : Analyse des logs JSON
- **Health Checks** : Monitoring externe via `/health`

## 🤝 Développement

```bash
# Installation
yarn install

# Tests (si disponibles)
yarn test

# Lint (si configuré)
yarn lint

# Build TypeScript
yarn build
```

## 📝 License

ISC