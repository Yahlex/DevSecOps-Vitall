# Explication de ma démarche DevSecOps

> Alexis Remy — M2 DFS — Février 2026

---

## Introduction

Pour cette évaluation, j'ai dû industrialiser un projet existant : **Vitall**, une plateforme SaaS pour les services institutionnels (pompiers, police, hôpitaux). Le projet était déjà fonctionnel en local avec Next.js, Prisma et Docker, mais il n'avait aucun pipeline CI/CD, aucune vérification de sécurité automatisée, et n'était pas déployé en production.

Mon objectif était de mettre en place une chaîne DevSecOps complète : du commit jusqu'au déploiement en production, en intégrant la sécurité à chaque étape.

---

## Ma compréhension du DevSecOps

Avant ce projet, je voyais la sécurité comme quelque chose qu'on fait « à la fin » — un audit une fois que tout est développé. Le DevSecOps change complètement cette vision : la sécurité doit être intégrée **dès le début** et **à chaque étape** du cycle de développement.

Le principe central c'est le **Shift Left** : au lieu de découvrir les problèmes de sécurité en production (quand c'est trop tard et cher à corriger), on les détecte le plus tôt possible dans le pipeline. Concrètement, ça veut dire que si je pousse du code avec une faille, le pipeline la détecte avant même que l'image Docker soit construite.

C'est pas juste « ajouter des outils de sécurité ». C'est une vraie philosophie où chaque développeur est responsable de la sécurité de ce qu'il produit. Le pipeline est là pour attraper ce qu'on peut rater manuellement.

---

## Les étapes que j'ai réalisées

### Étape 1 : Le pipeline CI de base (Lint + Tests + Build)

J'ai commencé par poser les fondations dans `.github/workflows/ci.yml` :
- **Lint** avec ESLint pour vérifier la qualité du code TypeScript
- **Tests** avec Vitest (35 tests unitaires sur l'auth, le middleware RBAC, l'API health, les utilitaires)
- **Build Docker** avec un push sur GitHub Container Registry (GHCR)

L'idée c'est que rien ne passe en production si le code ne compile pas, ne passe pas les tests, ou ne respecte pas les règles de lint.

### Étape 2 : SAST avec SonarQube

J'ai intégré SonarQube pour l'analyse statique du code (SAST — Static Application Security Testing). J'avais déjà une instance SonarQube self-hosted sur mon VPS, donc j'ai juste eu à créer le projet et configurer le job dans le pipeline.

SonarQube analyse le code sans l'exécuter pour détecter :
- Les **bugs** potentiels
- Les **vulnérabilités** de sécurité (injections SQL, XSS, etc.)
- Les **code smells** (code difficile à maintenir)

C'est du SAST parce qu'on analyse le code source directement, pas l'application en cours d'exécution (ça c'est du DAST).

### Étape 3 : SCA + Détection de secrets

Deux jobs supplémentaires ajoutés en parallèle :

**npm audit (SCA — Software Composition Analysis)** : On ne code jamais tout de zéro, on utilise des dépendances npm. Le problème c'est que ces dépendances peuvent avoir des vulnérabilités connues (CVE). `npm audit` vérifie chaque dépendance contre une base de données de vulnérabilités. Le pipeline bloque si une faille high ou critical est détectée.

**Gitleaks** : Cet outil scanne tout l'historique Git pour détecter des secrets (clés API, mots de passe, tokens) qui auraient été commités par erreur. C'est un filet de sécurité indispensable parce qu'un secret dans l'historique Git reste accessible même si on le supprime dans un commit suivant.

### Étape 4 : Scan de conteneur avec Trivy

J'ai choisi **Trivy** (par Aqua Security) pour scanner l'image Docker finale. Le workflow est :
1. Build de l'image en local (sans push)
2. Scan Trivy avec sévérité CRITICAL et `ignore-unfixed: true`
3. Push sur GHCR **uniquement si le scan passe**

J'ai choisi Trivy plutôt que Snyk parce qu'il est 100% open source, très rapide (quelques secondes), et il scanne à la fois les vulnérabilités OS (packages Alpine) et applicatives (dépendances npm) en une seule passe. Le flag `ignore-unfixed` est important : ça ne sert à rien de bloquer le pipeline pour une vulnérabilité qui n'a pas encore de correctif disponible.

### Étape 5 : Docker Compose de production

J'ai créé un `docker-compose.prod.yml` dédié à la production avec 6 services :
- **PostgreSQL** : Base de données
- **App** : Image depuis GHCR (pas de build local sur le VPS)
- **Prometheus** : Collecte des métriques
- **Grafana** : Visualisation
- **Loki** : Agrégation des logs
- **Promtail** : Collecte des logs Docker

J'ai séparé les réseaux Docker pour isoler les composants :
- `public` : Ce qui est exposé via le reverse proxy (app + Grafana)
- `backend` : Communication app ↔ PostgreSQL (isolée)
- `monitoring` : Stack de monitoring

### Étape 6 : Déploiement continu (CD)

Le job `deploy` se connecte au VPS via SSH, copie les fichiers de config (SCP), génère le `.env`, pull l'image et relance les services. C'est déclenché automatiquement à chaque push sur `main`, mais uniquement si tous les jobs de sécurité sont passés.

### Étape 7 : Observabilité

L'application expose ses métriques via `/api/metrics` avec `prom-client` :
- Uptime, CPU, mémoire
- Nombre de requêtes HTTP par route/méthode/status
- Latence des requêtes (histogramme avec percentiles)

Prometheus scrape ces métriques toutes les 15 secondes, Grafana les affiche dans un dashboard auto-provisionné, et Loki agrège les logs Docker via Promtail.

---

## Les difficultés rencontrées et comment je les ai résolues

### 1. Incompatibilité ESLint

**Problème** : Le projet utilisait `eslint-config-next` en version 0.2.4, qui était incompatible avec ESLint 10. Le lint crashait systématiquement en CI.

**Solution** : J'ai supprimé `eslint-config-next` et réécrit la configuration ESLint de zéro dans `eslint.config.mjs` en utilisant directement `@typescript-eslint/eslint-plugin` et `@typescript-eslint/parser`. Ça m'a permis de comprendre qu'il ne faut pas dépendre aveuglément des configs « clé en main » — parfois il faut savoir les remplacer.

### 2. Erreur de permissions Prisma au démarrage

**Problème** : En production, le conteneur tournait sous l'utilisateur `nextjs` (non-root). Mais `prisma db push` essayait de régénérer le client Prisma, ce qui nécessitait des permissions d'écriture dans `/usr/local/lib/node_modules/prisma/`. Le conteneur crashait en boucle.

**Solution** : J'ai ajouté le flag `--skip-generate` à la commande `prisma db push` dans le `docker-entrypoint.sh`. Le client Prisma est déjà généré lors du build Docker (stage 1), donc il n'y a pas besoin de le régénérer au démarrage. C'est un bon exemple de pourquoi il faut tester avec un utilisateur non-root — ça révèle des problèmes qu'on ne voit jamais quand on tourne en root.

### 3. Next.js standalone qui n'écoute pas sur le bon réseau

**Problème** : C'est le bug qui m'a pris le plus de temps. Prometheus ne pouvait pas scraper les métriques de l'app, alors que les deux conteneurs étaient bien sur le même réseau Docker. Le serveur Next.js affichait `Local: http://65b0587cb165:3000` au lieu de `http://0.0.0.0:3000`.

**Explication** : En mode standalone, Next.js utilise la variable d'environnement `HOSTNAME` pour déterminer l'adresse d'écoute. Or, Docker définit automatiquement `HOSTNAME` avec l'ID du conteneur. Du coup, le serveur n'écoutait que sur cette interface réseau interne, pas sur `0.0.0.0` (toutes les interfaces).

**Solution** : J'ai ajouté `HOSTNAME: "0.0.0.0"` dans les variables d'environnement du service `app` dans le docker-compose. Après ça, le serveur écoute sur toutes les interfaces et Prometheus peut scraper les métriques.

C'est le genre de bug fourbe qui prend du temps à diagnostiquer parce que tout semble bien configuré (même réseau, DNS qui résout, conteneur qui tourne) mais le problème est au niveau de l'application elle-même.

### 4. Dashboard Grafana qui ne se charge pas

**Problème** : Le dashboard Grafana n'apparaissait pas alors que les fichiers de provisioning étaient bien montés.

**Explication** : J'avais deux volumes qui se chevauchaient dans le compose :
- `./grafana/provisioning:/etc/grafana/provisioning` — monte le `dashboards.yml`
- `./grafana/dashboards:/etc/grafana/provisioning/dashboards` — écrase le dossier ci-dessus

Le deuxième volume montait par-dessus le premier, supprimant le fichier `dashboards.yml` de configuration et ne laissant que le JSON du dashboard.

**Solution** : J'ai séparé les chemins : les JSON de dashboards sont montés dans `/var/lib/grafana/dashboards` et le `dashboards.yml` pointe vers ce chemin. Plus de conflit de volumes.

### 5. Clé SSH pour le déploiement

**Problème** : Le job de déploiement échouait avec "key not found" alors que j'avais bien ajouté le secret GitHub.

**Solution** : En copiant la clé SSH dans le secret GitHub, j'avais perdu le retour à la ligne final. J'ai utilisé `pbcopy < ~/.ssh/id_ed25519_mds` pour copier proprement la clé depuis le terminal, ce qui a préservé le formatage exact.

---

## Pourquoi ces outils ?

| Outil | Pourquoi celui-là |
|-------|-------------------|
| **SonarQube** | Self-hosted sur mon VPS, donc pas de limite de scan. Analyse SAST complète avec Quality Gate configurable. |
| **Trivy** | Open source, gratuit, rapide. Scanne OS + dépendances en une passe. Mieux adapté qu'un outil freemium pour un projet étudiant. |
| **Gitleaks** | Scanne tout l'historique Git, pas juste le dernier commit. Détection par signatures regex des formats de secrets courants. |
| **npm audit** | Natif à npm, zero config. Vérifie contre la base de données de vulnérabilités GitHub Advisory. |
| **Prometheus + Grafana** | Standard de l'industrie pour le monitoring. Prometheus pour la collecte (pull model), Grafana pour la visualisation. |
| **Loki + Promtail** | S'intègre nativement avec Grafana. Promtail collecte les logs Docker sans toucher à l'application. |
| **Nginx Proxy Manager** | Interface graphique pour gérer les reverse proxys et les certificats Let's Encrypt. Pratique pour un VPS multi-services. |

---

## Comment j'ai sécurisé le pipeline

Le pipeline est conçu pour que **rien ne passe en production sans validation** :

1. **Gate 1 — Code** : Le lint et les tests bloquent si le code est cassé
2. **Gate 2 — Sécurité du code** : SonarQube bloque si la Quality Gate échoue (vulnérabilités, bugs critiques)
3. **Gate 3 — Supply Chain** : npm audit bloque si une dépendance a une CVE high/critical
4. **Gate 4 — Secrets** : Gitleaks bloque si un secret est détecté dans l'historique
5. **Gate 5 — Image** : Trivy bloque si l'image Docker contient une vulnérabilité CRITICAL
6. **Gate 6 — Déploiement** : Le deploy ne s'exécute que si TOUTES les gates précédentes sont passées

En plus du pipeline, le Dockerfile lui-même applique des mesures de sécurité :
- Image Alpine (surface d'attaque minimale)
- npm supprimé en prod (élimine plusieurs CVE connues)
- Utilisateur non-root (limitation des privilèges)
- Build multi-stage (l'image finale ne contient que le nécessaire)

---

## Ce que j'ai appris

Ce projet m'a fait comprendre que le DevSecOps c'est pas juste « coller des outils de sécurité dans un pipeline ». C'est une façon de penser le développement où :

- La sécurité n'est pas un frein, c'est un **filet de sécurité** qui permet d'aller plus vite avec confiance
- Chaque couche a sa propre protection (code, dépendances, secrets, image, runtime)
- L'automatisation est clé : si c'est manuel, ça sera oublié un jour
- Le monitoring en production est aussi important que les tests : il faut savoir quand quelque chose ne va pas

Les bugs les plus difficiles à trouver étaient souvent liés à l'infrastructure (Docker, réseaux, permissions) plutôt qu'au code applicatif. C'est là qu'on voit l'importance de comprendre toute la stack, pas juste le framework.

---

*Alexis Remy — M2 DFS — Évaluation DevSecOps — Février 2026*
