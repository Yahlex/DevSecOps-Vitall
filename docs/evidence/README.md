# 📸 Preuves de validation (Evidence)

Ce dossier contient les captures d'écran attestant du bon fonctionnement du pipeline CI/CD, de la sécurité et du monitoring.

## Captures

| Fichier | Description |
|---------|-------------|
| `ci-pipeline-success.png` | Pipeline GitHub Actions complet au vert (7 jobs : lint, test, sonarqube, sca, secrets-scan, build, deploy) |
| `sonarqube-sucess.png` | Tableau de bord SonarQube — analyse SAST (bugs, vulnérabilités, code smells) |
| `sonarqube-coverage.png` | SonarQube — couverture de code (14 % global, ~43 % sur le code métier) |
| `grafana.png` | Dashboard Grafana « Vitall Monitoring » — métriques Prometheus et logs Loki |
| `NGPM.png` | Nginx Proxy Manager — configuration des proxy hosts (HTTPS / Let's Encrypt) |

## Détail des captures

### 1. `ci-pipeline-success.png`
Pipeline CI/CD GitHub Actions avec les 7 jobs au vert, visible sur [GitHub Actions](https://github.com/Yahlex/DevSecOps-Vitall/actions).

### 2. `sonarqube-sucess.png`
Tableau de bord SonarQube montrant l'analyse statique du code (SAST) : bugs, vulnérabilités, security hotspots, code smells et Quality Gate.

### 3. `sonarqube-coverage.png`
Vue SonarQube affichant la couverture de code générée par Vitest + `@vitest/coverage-v8` (rapport LCOV).

### 4. `grafana.png`
Dashboard Grafana connecté à Prometheus (métriques HTTP, uptime, CPU/mémoire) et Loki (logs applicatifs en temps réel).

### 5. `NGPM.png`
Nginx Proxy Manager montrant les proxy hosts configurés (`vitall.alexis.remy.mds-nantes.fr`, `grafana-vitall.alexis.remy.mds-nantes.fr`) avec certificats SSL Let's Encrypt.
