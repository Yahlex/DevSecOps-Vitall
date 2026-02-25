# 🏗️ Architecture du Projet Vitall

> Document d'architecture technique — Évaluation DevSecOps M2 DFS 2025/2026

---

## Vue d'ensemble

Vitall est une plateforme SaaS modulaire destinée aux services institutionnels (pompiers, police, hôpitaux). Le projet est conteneurisé, déployé sur un VPS via un pipeline CI/CD automatisé intégrant des contrôles de sécurité à chaque étape.

---

## 1. Schéma d'architecture globale

```
                        ┌──────────────────────────────────────────────────────┐
                        │                  DÉVELOPPEUR                         │
                        │          git push → GitHub (main)                    │
                        └─────────────────────┬────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              GITHUB ACTIONS — CI/CD PIPELINE                                │
│                                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌───────────┐                    │
│  │  Lint   │  │  Tests  │  │ SonarQube  │  │npm audit │  │ Gitleaks  │   (Parallèle)      │
│  │ ESLint  │  │ Vitest  │  │   SAST     │  │   SCA    │  │ Secrets   │                    │
│  └────┬────┘  └────┬────┘  └─────┬──────┘  └────┬─────┘  └─────┬─────┘                    │
│       │            │             │               │              │                           │
│       └────────────┴──────┬──────┴───────────────┴──────────────┘                           │
│                           │ Tout doit passer ✅                                             │
│                           ▼                                                                 │
│              ┌──────────────────────────┐                                                   │
│              │  Build Docker + Trivy    │                                                   │
│              │  Scan (CRITICAL) → GHCR  │                                                   │
│              └────────────┬─────────────┘                                                   │
│                           │                                                                 │
│                           ▼                                                                 │
│              ┌──────────────────────────┐                                                   │
│              │   Deploy via SSH (VPS)   │                                                   │
│              │  SCP configs + compose   │                                                   │
│              └──────────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                        VPS INFOMANIAK (Ubuntu 24.04)                                        │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │              NGINX PROXY MANAGER (HTTPS / Let's Encrypt)                            │    │
│  │  vitall.alexis.remy.mds-nantes.fr → vitall-app:3000                                │    │
│  │  grafana-vitall.alexis.remy.mds-nantes.fr → vitall-grafana:3000                    │    │
│  └─────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                             │
│  ┌── Réseau "public" ──────────────────────────────────────────────────────────────────┐    │
│  │  ┌────────────┐           ┌─────────────┐                                          │    │
│  │  │ vitall-app │           │   Grafana   │                                          │    │
│  │  │ (Next.js)  │           │   :3000     │                                          │    │
│  │  │  :3000     │           │             │                                          │    │
│  │  └──────┬─────┘           └──────┬──────┘                                          │    │
│  └─────────┼────────────────────────┼─────────────────────────────────────────────────┘    │
│            │                        │                                                       │
│  ┌── Réseau "backend" ──┐   ┌── Réseau "monitoring" ─────────────────────────────┐         │
│  │  ┌────────────┐      │   │  ┌────────────┐  ┌──────┐  ┌──────────┐           │         │
│  │  │ PostgreSQL │      │   │  │ Prometheus │  │ Loki │  │ Promtail │           │         │
│  │  │ :5432      │      │   │  │ :9090      │  │:3100 │  │ (agent)  │           │         │
│  │  └────────────┘      │   │  └────────────┘  └──────┘  └──────────┘           │         │
│  └──────────────────────┘   └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack technique

| Couche              | Technologie                        | Version  |
| ------------------- | ---------------------------------- | -------- |
| **Frontend**        | Next.js (App Router)               | 16.1.5   |
| **UI**              | React + TailwindCSS + shadcn/ui    | 19       |
| **Langage**         | TypeScript                         | 5.x      |
| **ORM**             | Prisma                             | 6.19.1   |
| **Base de données** | PostgreSQL (Alpine)                | 16       |
| **Runtime**         | Node.js (Alpine)                   | 20       |
| **Conteneurisation**| Docker + Docker Compose            | 27+      |
| **CI/CD**           | GitHub Actions                     | –        |
| **Registry**        | GitHub Container Registry (GHCR)   | –        |
| **Reverse Proxy**   | Nginx Proxy Manager                | –        |
| **SAST**            | SonarQube (self-hosted)            | –        |
| **SCA**             | npm audit                          | –        |
| **Container Scan**  | Trivy                              | –        |
| **Secret Scan**     | Gitleaks                           | –        |
| **Métriques**       | Prometheus + prom-client           | –        |
| **Visualisation**   | Grafana                            | –        |
| **Logs**            | Loki + Promtail                    | –        |

---

## 3. Pipeline CI/CD détaillé

Le pipeline est défini dans `.github/workflows/ci.yml` et comprend **7 jobs** :

### Phase 1 — Qualité & Sécurité (parallèle)

| Job | Outil | Rôle | Bloquant si |
|-----|-------|------|-------------|
| **Lint** | ESLint | Vérification du style et des bonnes pratiques | Erreurs de lint |
| **Tests** | Vitest | 35 tests unitaires (auth, middleware, API, utils) | Test échoué |
| **SonarQube** | SonarQube (SAST) | Analyse statique : bugs, vulnérabilités, code smells | Quality Gate échoué |
| **SCA** | npm audit | Audit des dépendances (Supply Chain) | Vulnérabilité high/critical |
| **Secrets** | Gitleaks | Détection de secrets dans l'historique Git | Secret détecté |

### Phase 2 — Build & Scan (séquentiel, nécessite Phase 1 ✅)

| Étape | Action |
|-------|--------|
| 1 | Build de l'image Docker en local (multi-stage) |
| 2 | Scan Trivy de l'image (sévérité CRITICAL, ignore-unfixed) |
| 3 | Push sur GHCR si le scan passe (`latest` + tag SHA) |

### Phase 3 — Déploiement (uniquement branche `main`)

| Étape | Action |
|-------|--------|
| 1 | Création des dossiers sur le VPS via SSH |
| 2 | Copie des fichiers de configuration (SCP) |
| 3 | Génération du `.env`, pull de l'image, `docker compose up -d` |

---

## 4. Sécurité (DevSecOps)

### Shift Left Security

La sécurité est intégrée à **chaque étape** du pipeline, pas seulement en fin de chaîne :

```
Code → Lint → Tests → SAST → SCA → Secrets → Build → Container Scan → Deploy
  ↑       ↑      ↑      ↑      ↑       ↑                  ↑
  │    qualité  fonct.  code   deps   leaks              image
  │                                                        │
  └────────────── Shift Left ──────────────────────────────┘
```

### Mesures de sécurité appliquées

| Mesure | Détail |
|--------|--------|
| **Image Alpine** | `node:20-alpine` — surface d'attaque minimale |
| **npm supprimé en prod** | Élimine les vulnérabilités de `cross-spawn`, `glob`, `tar` |
| **Utilisateur non-root** | Conteneur exécuté sous `nextjs` (UID 1001) |
| **Build multi-stage** | L'image finale ne contient que le strict nécessaire |
| **Trivy (Container Scan)** | Bloque les vulnérabilités CRITICAL dans l'image |
| **SonarQube (SAST)** | Détecte bugs, vulnérabilités et code smells |
| **npm audit (SCA)** | Vérifie les dépendances de la supply chain |
| **Gitleaks** | Empêche la fuite de secrets dans le dépôt |
| **JWT httpOnly** | Cookies sécurisés, non accessibles en JavaScript |
| **bcrypt** | Mots de passe hashés avec 10 rounds de salage |
| **Middleware RBAC** | Routes protégées par rôle (ADMIN/USER) |
| **HTTPS (Let's Encrypt)** | Certificats SSL automatiques via Nginx Proxy Manager |

---

## 5. Infrastructure Docker

### Image de production (multi-stage)

```dockerfile
# Stage 1 : Builder
node:20-alpine → npm ci → prisma generate → npm run build

# Stage 2 : Runner
node:20-alpine → copie standalone + prisma CLI → npm supprimé → user nextjs
```

**Taille de l'image** : ~200 MB (vs ~1 GB sans multi-stage)

### Réseaux Docker

| Réseau | Services | Rôle |
|--------|----------|------|
| `public` | app, grafana, NPM | Exposition via reverse proxy |
| `backend` | app, postgres | Communication DB isolée |
| `monitoring` | app, prometheus, grafana, loki, promtail | Stack d'observabilité |

### Volumes persistants

| Volume | Service | Données |
|--------|---------|---------|
| `postgres_data` | PostgreSQL | Base de données |
| `prometheus_data` | Prometheus | Métriques (rétention 15j) |
| `grafana_data` | Grafana | Dashboards, préférences |
| `loki_data` | Loki | Logs (rétention 7j) |

---

## 6. Observabilité

### Architecture de monitoring

```
Next.js App ─── /api/metrics ──→ Prometheus ──→ Grafana (dashboards)
     │                                              ↑
     └─── docker logs ──→ Promtail ──→ Loki ───────┘
```

### Métriques exposées (`prom-client`)

| Métrique | Type | Description |
|----------|------|-------------|
| `app_uptime_seconds` | Gauge | Uptime de l'application |
| `http_requests_total` | Counter | Requêtes HTTP par méthode/route/status |
| `http_request_duration_seconds` | Histogram | Latence des requêtes (P50, P95, P99) |
| `process_cpu_usage_percent` | Gauge | Usage CPU du processus |
| `process_resident_memory_bytes` | Gauge | Mémoire RSS |
| `process_heap_bytes` | Gauge | Heap Node.js |

### Dashboard Grafana

Le dashboard "Vitall Monitoring Dashboard V2" est **auto-provisionné** et affiche :
- Status de l'application (UP/DOWN)
- Uptime, CPU, mémoire
- Taux de requêtes HTTP et latences
- Logs en temps réel (via Loki)

### URLs de production

| Service | URL |
|---------|-----|
| Application | https://vitall.alexis.remy.mds-nantes.fr |
| Grafana | https://grafana-vitall.alexis.remy.mds-nantes.fr |
| SonarQube | https://sonarqube.alexis.remy.mds-nantes.fr |

---

## 7. Procédure de rollback

En cas de problème après un déploiement :

### Rollback rapide (image précédente)

```bash
# 1. Se connecter au VPS
ssh ubuntu@83.228.218.94

# 2. Lister les images disponibles
docker images ghcr.io/yahlex/devsecops-vitall --format "{{.Tag}}\t{{.CreatedAt}}"

# 3. Revenir à une version spécifique (tag SHA du commit)
cd ~/apps/vitall
sed -i 's|image: ghcr.io/yahlex/devsecops-vitall:latest|image: ghcr.io/yahlex/devsecops-vitall:<sha-du-commit>|' docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d app

# 4. Vérifier le statut
docker compose -f docker-compose.prod.yml ps
curl -s https://vitall.alexis.remy.mds-nantes.fr/api/health
```

### Rollback base de données

```bash
# Backup avant chaque déploiement (automatisable)
docker exec vitall-postgres pg_dump -U vitall_user vitall_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restauration
docker exec -i vitall-postgres psql -U vitall_user vitall_db < backup_YYYYMMDD_HHMMSS.sql
```

### Rollback complet

```bash
# Revenir au commit précédent sur GitHub
git revert HEAD
git push

# Le CI/CD va automatiquement rebuilder et redéployer
```

---

## 8. Secrets et configuration

### Secrets GitHub Actions

| Secret | Description |
|--------|-------------|
| `SONAR_TOKEN` | Token d'authentification SonarQube |
| `SONAR_HOST_URL` | URL du serveur SonarQube |
| `VPS_HOST` | Adresse IP du VPS |
| `VPS_USER` | Utilisateur SSH du VPS |
| `VPS_SSH_KEY` | Clé privée SSH (Ed25519) |
| `GITHUB_TOKEN` | Fourni automatiquement par GitHub |

### Variables d'environnement de production

Les variables sont générées dans le `.env` directement sur le VPS lors du déploiement (étape 3 du job deploy). Elles ne sont **jamais commitées** dans le dépôt.

---

## 9. Tests

| Type | Outil | Nombre | Couverture |
|------|-------|--------|------------|
| Unitaires | Vitest | 35 | Auth, middleware, API, utils |
| Lint | ESLint | – | TypeScript + React |
| SAST | SonarQube | – | Bugs, vulns, code smells |

### Fichiers de test

- `src/__tests__/middleware.test.ts` — Tests du middleware d'authentification RBAC
- `src/__tests__/lib/auth.test.ts` — Tests des fonctions JWT (sign, verify)
- `src/__tests__/lib/utils.test.ts` — Tests des utilitaires
- `src/__tests__/api/health.test.ts` — Tests du endpoint health
- `src/__tests__/api/auth/` — Tests des routes d'authentification

---

*Alexis Remy — M2 DFS — Évaluation DevSecOps — 2025/2026*
