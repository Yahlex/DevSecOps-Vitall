# 🏥 Vitall Solution

> Plateforme SaaS modulaire pour les services institutionnels (Pompiers, Police, Hôpitaux).  
> Projet industrialisé dans le cadre de l'évaluation **DevSecOps — M2 DFS 2025/2026**.

| | URL |
|---|---|
| 🌐 **Application** | https://vitall.alexis.remy.mds-nantes.fr |
| 📊 **Grafana** | https://grafana-vitall.alexis.remy.mds-nantes.fr |
| 🔍 **SonarQube** | https://sonarqube.alexis.remy.mds-nantes.fr |
| 📦 **Registry** | ghcr.io/yahlex/devsecops-vitall |

### 🔐 Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| **Admin** | `admin@test.fr` | `password123` |
| **Utilisateur** | `user@test.fr` | `user123` |

---

## 📑 Table des matières

- [Stack technique](#-stack-technique)
- [Démarrage rapide](#-démarrage-rapide)
- [Docker](#-docker)
- [Pipeline CI/CD](#-pipeline-cicd)
- [Sécurité DevSecOps](#-sécurité-devsecops)
- [Observabilité](#-observabilité)
- [Infrastructure de production](#-infrastructure-de-production)
- [Variables d'environnement](#-variables-denvironnement)
- [Scripts utiles](#-scripts-utiles)

> 📐 **Architecture détaillée** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
> 📝 **Explication de la démarche** → [docs/explications.md](docs/explications.md)  
> 📸 **Preuves de validation** → [docs/evidence/](docs/evidence/)

---

## 🧩 Stack technique

| Domaine | Technologie |
|---------|-------------|
| **Framework** | Next.js 16 (App Router) + React 19 + TypeScript |
| **Base de données** | PostgreSQL 16 + Prisma ORM 6 |
| **Auth** | JWT (jose) + bcrypt + middleware RBAC |
| **Tests** | Vitest (35 tests unitaires) |
| **CI/CD** | GitHub Actions (7 jobs) |
| **SAST** | SonarQube (self-hosted) |
| **SCA** | npm audit |
| **Container Scan** | Trivy (Aqua Security) |
| **Secret Scan** | Gitleaks |
| **Conteneurisation** | Docker multi-stage (Alpine) |
| **Monitoring** | Prometheus + Grafana + Loki + Promtail |
| **Reverse Proxy** | Nginx Proxy Manager + Let's Encrypt |
| **Hébergement** | VPS Infomaniak (Ubuntu 24.04) |

---

## 🚀 Démarrage rapide

```bash
# Cloner et configurer
git clone https://github.com/Yahlex/DevSecOps-Vitall.git
cd vitall-solution
cp .env.example .env   # Remplir les variables

# Option 1 : Développement local
npm install
npx prisma generate && npx prisma db push
npm run dev             # → http://localhost:3000

# Option 2 : Docker
docker compose up -d    # PostgreSQL + App + Monitoring
```

---

## 🐳 Docker

### Build multi-stage

```
Stage 1 (Builder)  → node:20-alpine → npm ci → prisma generate → npm run build
Stage 2 (Runner)   → node:20-alpine → standalone output → npm supprimé → user nextjs (UID 1001)
```

**Mesures de sécurité du Dockerfile :**
- Image Alpine (surface d'attaque minimale)
- npm supprimé en production (élimine les CVE de `cross-spawn`, `glob`, `tar`)
- Utilisateur non-root `nextjs` (UID 1001)
- Seul le strict nécessaire est copié (mode `standalone`)

### Fichiers compose

| Fichier | Usage |
|---------|-------|
| `docker-compose.yml` | Développement local (PostgreSQL + App) |
| `compose.override.yml` | Surcharge dev (hot reload, volumes) |
| `docker-compose.prod.yml` | **Production** — utilisé pour le déploiement VPS |

---

## ⚙️ Pipeline CI/CD

Fichier : `.github/workflows/ci.yml` — Déclenché sur chaque **push** et **pull request** vers `main`.

```
                              Push / PR sur main
                                     │
          ┌──────────┬───────────┬───┴───┬───────────┬──────────┐
          ▼          ▼           ▼       ▼           ▼          │
      ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
      │  Lint  │ │ Tests  │ │ Sonar  │ │  SCA   │ │Gitleaks│   │  Phase 1
      │ ESLint │ │ Vitest │ │ (SAST) │ │  npm   │ │Secrets │   │  (parallèle)
      └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘   │
          └──────────┴──────┬───┴──────────┴──────────┘         │
                            │ ✅ Tout doit passer                │
                            ▼                                    │
                  ┌──────────────────┐                           │  Phase 2
                  │ Build + Trivy    │                           │
                  │ Scan → Push GHCR │                           │
                  └────────┬─────────┘                           │
                           │                                     │
                           ▼                                     │
                  ┌──────────────────┐                           │  Phase 3
                  │ Deploy to VPS    │  (main uniquement)        │
                  │ SSH + SCP        │                           │
                  └──────────────────┘                           │
```

### Détail des 7 jobs

| # | Job | Outil | Rôle | Bloquant si |
|---|-----|-------|------|-------------|
| 1 | `lint` | ESLint | Qualité de code TypeScript/React | Erreurs de lint |
| 2 | `test` | Vitest | 35 tests unitaires | Test échoué |
| 3 | `sonarqube` | SonarQube | SAST — bugs, vulnérabilités, code smells | Quality Gate échoué |
| 4 | `sca` | npm audit | Audit des dépendances (Supply Chain) | Vulnérabilité high/critical |
| 5 | `secrets-scan` | Gitleaks | Scan de l'historique Git complet | Secret détecté |
| 6 | `build` | Docker + Trivy | Build image → scan CRITICAL → push GHCR | Vulnérabilité CRITICAL |
| 7 | `deploy` | SSH/SCP | Déploiement automatique sur le VPS | — |

### Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `SONAR_TOKEN` | Token SonarQube |
| `SONAR_HOST_URL` | URL du serveur SonarQube |
| `VPS_HOST` | Adresse IP du VPS |
| `VPS_USER` | Utilisateur SSH |
| `VPS_SSH_KEY` | Clé privée SSH (Ed25519) |

---

## 🛡️ Sécurité DevSecOps

### Principe : Shift Left

La sécurité est intégrée à **chaque étape** du pipeline, pas seulement en fin de chaîne :

```
Code → Lint → Tests → SAST → SCA → Secrets → Build → Container Scan → Deploy
                       ↑      ↑       ↑                    ↑
                      code   deps   leaks                 image
```

### Mesures appliquées

| Couche | Mesure | Détail |
|--------|--------|--------|
| **Code** | SonarQube (SAST) | Analyse statique : bugs, vulnérabilités, code smells |
| **Dépendances** | npm audit (SCA) | Bloque si vulnérabilité high ou critical |
| **Secrets** | Gitleaks | Scan historique Git complet |
| **Image** | Trivy | Scan de l'image Docker (sévérité CRITICAL) |
| **Image** | Alpine + multi-stage | Surface d'attaque minimale, npm supprimé |
| **Runtime** | Non-root | Conteneur sous utilisateur `nextjs` (UID 1001) |
| **Auth** | JWT httpOnly + bcrypt | Cookies sécurisés, mots de passe hashés (10 rounds) |
| **Routes** | Middleware RBAC | Protection par rôle (ADMIN/USER) |
| **Transport** | HTTPS (Let's Encrypt) | Certificats SSL automatiques via Nginx Proxy Manager |

---

## 📊 Observabilité

### Architecture de monitoring

```
Next.js App ─── /api/metrics ───→ Prometheus ───→ Grafana (dashboards)
     │                                                ↑
     └─── docker logs ───→ Promtail ───→ Loki ───────┘
```

### Métriques exposées (prom-client)

| Métrique | Type | Description |
|----------|------|-------------|
| `app_uptime_seconds` | Gauge | Uptime de l'application |
| `http_requests_total` | Counter | Requêtes HTTP (méthode/route/status) |
| `http_request_duration_seconds` | Histogram | Latence (P50, P95, P99) |
| `process_cpu_usage_percent` | Gauge | CPU du processus Node.js |
| `process_resident_memory_bytes` | Gauge | Mémoire RSS |

### Dashboard Grafana

Le dashboard **"Vitall Monitoring Dashboard V2"** est auto-provisionné et affiche :
- Status UP/DOWN de l'application
- Uptime, CPU, mémoire
- Taux de requêtes HTTP et latences
- Logs en temps réel (via Loki)

### Accès local

| Service | URL | Identifiants |
|---------|-----|-------------|
| Application | http://localhost:3000 | — |
| Grafana | http://localhost:3001 | admin / admin |
| Prometheus | http://localhost:9090 | — |

---

## 🏗️ Infrastructure de production

### VPS Infomaniak (Ubuntu 24.04)

| Composant | Détail |
|-----------|--------|
| **Reverse proxy** | Nginx Proxy Manager (HTTPS automatique) |
| **Réseau `public`** | App + Grafana (exposés via NPM) |
| **Réseau `backend`** | App + PostgreSQL (isolé) |
| **Réseau `monitoring`** | App + Prometheus + Grafana + Loki + Promtail |

### Services déployés

| Service | Image | Volumes |
|---------|-------|---------|
| PostgreSQL | `postgres:16-alpine` | `postgres_data` (persistant) |
| App | `ghcr.io/yahlex/devsecops-vitall` | — |
| Prometheus | `prom/prometheus` | `prometheus_data` (rétention 15j) |
| Grafana | `grafana/grafana` | `grafana_data` + provisioning |
| Loki | `grafana/loki` | `loki_data` (rétention 7j) |
| Promtail | `grafana/promtail` | Docker socket (read-only) |

### Procédure de rollback

```bash
# Rollback vers une version précédente
ssh ubuntu@<VPS_IP>
cd ~/apps/vitall
docker pull ghcr.io/yahlex/devsecops-vitall:<sha-du-commit>
sed -i 's|:latest|:<sha-du-commit>|' docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d app

# Ou rollback via Git (le CI/CD redéploie automatiquement)
git revert HEAD && git push
```

---

## 🔑 Variables d'environnement

Copier `.env.example` et adapter les valeurs :

```env
DATABASE_URL="postgresql://user:password@localhost:5432/vitall_db?schema=public"
JWT_SECRET="<valeur-aléatoire-32-caractères>"
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NODE_ENV="production"
```

> ⚠️ Ne **jamais** commiter `.env` avec des secrets réels. Utiliser les secrets GitHub Actions et le `.env` généré sur le VPS lors du déploiement.

---

## 📋 Scripts utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production |
| `npm run test` | Tests unitaires (Vitest) |
| `npm run lint` | Vérification ESLint |
| `npx prisma studio` | Interface web de la BDD |
| `npx prisma db push` | Appliquer le schéma Prisma |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Schéma du pipeline CI/CD et de l'infrastructure |
| [docs/explications.md](docs/explications.md) | Explication de la démarche DevSecOps |
| [docs/evidence/](docs/evidence/) | Captures d'écran de validation |

---

*Alexis Remy — M2 DFS — Évaluation DevSecOps — 2025/2026*
