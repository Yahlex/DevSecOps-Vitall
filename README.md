# 🏥 Vitall Solution

> Plateforme SaaS pour les services institutionnels (Pompiers, Police, Hôpitaux).  
> Projet industrialisé — **DevSecOps M2 DFS 2025/2026**.

### 🔐 Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | `admin@test.fr` | `password123` |
| Utilisateur | `user@test.fr` | `user123` |

> 📐 [Architecture détaillée](docs/ARCHITECTURE.md) · 📝 [Démarche DevSecOps](docs/explications.md) · 📸 [Captures de validation](docs/evidence/)

---

## 🧩 Stack technique

| Domaine | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| BDD | PostgreSQL 16 + Prisma ORM 6 |
| Auth | JWT (jose) + bcrypt + middleware RBAC |
| Tests | Vitest (35 tests unitaires) |
| CI/CD | GitHub Actions (7 jobs) |
| Sécurité | SonarQube (SAST) · npm audit (SCA) · Gitleaks · Trivy |
| Conteneurisation | Docker multi-stage (node:20-alpine), user non-root |
| Monitoring | Prometheus + Grafana + Loki + Promtail |
| Infra | VPS Infomaniak (Ubuntu 24.04) + Nginx Proxy Manager + Let's Encrypt |

---

## 🚀 Démarrage rapide

```bash
git clone https://github.com/Yahlex/DevSecOps-Vitall.git && cd vitall-solution
cp .env.example .env

# Local
npm install && npx prisma generate && npx prisma db push && npm run dev

# Docker
docker compose up -d
```

---

## 🐳 Docker

**Build multi-stage** : `node:20-alpine` → `npm ci` → `prisma generate` → `build` → image standalone, npm supprimé, user `nextjs` (UID 1001).

Sécurité : Alpine (surface minimale), npm supprimé en prod, utilisateur non-root, mode standalone (strict nécessaire).

| Fichier compose | Usage |
|-----------------|-------|
| `docker-compose.yml` | Dev local |
| `compose.override.yml` | Surcharge dev (hot reload) |
| `docker-compose.prod.yml` | Production (VPS) |

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

| Couche | Mesure |
|--------|--------|
| Code | SonarQube — bugs, vulnérabilités, code smells |
| Dépendances | npm audit — bloque si CVE high/critical |
| Secrets | Gitleaks — scan historique Git complet |
| Image | Trivy (CRITICAL) + Alpine + multi-stage + npm supprimé |
| Runtime | User non-root `nextjs` (UID 1001) |
| Auth | JWT httpOnly + bcrypt (10 rounds) + RBAC |
| Transport | HTTPS Let's Encrypt (Nginx Proxy Manager) |

---

## 📊 Observabilité

```
App ── /api/metrics ──→ Prometheus ──→ Grafana
 └── docker logs ──→ Promtail ──→ Loki ──→ Grafana
```

Métriques exposées (`prom-client`) : uptime, requêtes HTTP (count + latence P50/P95/P99), CPU, mémoire RSS.

Dashboard **"Vitall Monitoring V2"** auto-provisionné : status UP/DOWN, métriques système, taux de requêtes, logs temps réel.

| Service | URL locale | Identifiants |
|---------|-----------|-------------|
| App | http://localhost:3000 | — |
| Grafana | http://localhost:3001 | admin / admin |
| Prometheus | http://localhost:9090 | — |

---

## 🏗️ Infrastructure de production

VPS Infomaniak (Ubuntu 24.04) — 6 services Docker, 3 réseaux isolés :

| Réseau | Services |
|--------|----------|
| `public` | App + Grafana (exposés via NPM) |
| `backend` | App + PostgreSQL (isolé) |
| `monitoring` | Prometheus + Grafana + Loki + Promtail |

| Service | Image |
|---------|-------|
| PostgreSQL | `postgres:16-alpine` |
| App | `ghcr.io/yahlex/devsecops-vitall` |
| Prometheus | `prom/prometheus` (rétention 15j) |
| Grafana | `grafana/grafana` (provisionné) |
| Loki | `grafana/loki` (rétention 7j) |
| Promtail | `grafana/promtail` |

**Rollback** : `git revert HEAD && git push` (le CD redéploie automatiquement).

---

## 🔑 Variables d'environnement

```env
DATABASE_URL="postgresql://user:password@localhost:5432/vitall_db?schema=public"
JWT_SECRET="<random-32-chars>"
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NODE_ENV="production"
```

> ⚠️ Ne jamais commiter `.env`. Secrets dans GitHub Actions + `.env` généré sur le VPS au deploy.

---

## 📋 Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Dev (Turbopack) |
| `npm run build` | Build prod |
| `npm run test` | Tests Vitest |
| `npm run lint` | ESLint |
| `npx prisma studio` | Interface BDD |

---

*Alexis Remy — M2 DFS — DevSecOps — 2025/2026*
