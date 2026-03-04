# Explication de ma démarche DevSecOps

Alexis Remy — M2 DFS — 2025/2026

---

## Le point de départ

Pour ce projet j'ai repris **Vitall**, une app SaaS qu'on a développée avec Isaac pour les services institutionnels (pompiers, police, hôpitaux). Le projet marchait déjà en local avec Next.js, Prisma et Docker, mais y'avait aucun pipeline, aucune sécu automatisée, rien en prod. Fallait tout "industrialiser".

Je suis reparti du repo d'Isaac et j'ai tout monté de zéro en local.

---

## Ma compréhension du DevSecOps

Dans mon entreprise j'ai pas vraiment de CI/CD sur la partie web. Concrètement je gère deux WordPress et je fais de l'intégration web directement sur CMS. Côté applicatif interne on développe avec WinDev, et le logiciel intègre déjà pas mal de choses qu'on retrouve dans une pipeline DevOps classique : y'a un gestionnaire de sources (GDS) qui fait office de versioning comme Git, un système d'audit de code intégré qui analyse la qualité et les erreurs potentielles (un peu comme SonarQube), la compilation et le déploiement se font en un clic depuis l'éditeur, et y'a même un tableau de bord de monitoring avec des metrics sur les performances de l'app. En gros WinDev embarque son propre écosystème CI/CD sans qu'on ait besoin de brancher des outils externes. Du coup au boulot j'avais jamais eu besoin de monter tout ça moi-même, c'est pour ça que ce projet c'était vraiment l'occasion de comprendre comment ça marche sur des outils plus classique au web et de tout faire de A à Z :D


---

## La pipeline

J'ai choisi GitHub Actions parce que c'est gratuit, intégré direct dans le repo, et on avait déjà une base via le cours de DevOps. Le principe est simple : dès qu'on push sur `main`, ça lance tout automatiquement.

La pipeline a **7 jobs** qui tournent dans cet ordre :

1. **Lint** (ESLint) — ça vérifie que le code est propre
2. **Tests** (Vitest) — 35 tests unitaires sur l'auth, le middleware, l'API(on peut en mettre encore plus et d'autres types de tests)
3. **SonarQube** — analyse statique du code, bugs, failles, code smells
4. **npm audit** — vérifie que les dépendances npm ont pas de failles connues
5. **Gitleaks** — scanne l'historique Git pour vérifier qu'on a pas commit un mot de passe ou une clé API par erreur
6. **Build + Trivy** — build l'image Docker, la scanne avec Trivy, et si c'est bon la push sur GHCR
7. **Deploy** — se connecte au VPS en SSH et relance les conteneurs

Chaque étape dépend de la précédente, donc si y'a un souci quelque part ça bloque et ça deploy pas. C'est le but.

### Les secrets

Les mots de passe, tokens, clés API, tout ça n'est jamais dans le repo. En local c'est dans le `.env`, en CI c'est dans les GitHub Secrets, et sur le VPS le `.env` est généré par le pipeline au moment du deploy. Même si quelqu'un fork le repo il peut rien faire sans les credentials.

Pour les clés SSH j'avais déjà ma paire que j'avais générée pendant le cours de DevOps, du coup j'ai juste eu à l'ajouter dans les secrets GitHub.

---

## Pourquoi ces outils ?

**GitHub Actions** : Gratuit, un fichier YAML et c'est parti. Y'a plein d'actions toutes faites genre `actions/setup-node@v4` qui simplifient la vie.

**SonarQube** : Je l'ai self-hosted sur mon VPS. Ça analyse le code sans l'exécuter (SAST) et ça détecte les bugs, les failles, les code smells. Comme c'est self-hosted y'a pas de limite de scan.

**Trivy** : Open source, gratuit, rapide. Ça scanne l'image Docker (les packages Alpine + les dépendances npm) en une seule passe. J'ai préféré ça à Snyk qui est freemium.

**Gitleaks** : Ça scanne tout l'historique Git, pas juste le dernier commit. Parce qu'un secret qui a été commit une fois reste dans l'historique même si on le supprime après.

**npm audit** : C'est natif à npm, zéro config. Ça check les dépendances contre la base de vulnérabilités GitHub Advisory.

**Docker** : Pour être sûr que l'app tourne pareil partout. Ce qui marche en local marchera en prod. Et ça ajoute une couche d'isolation en cas de souci.

**Prometheus + Grafana + Loki** : Pour savoir ce qui se passe en prod sans devoir SSH sur le serveur toutes les 5 min. On voit les logs, les erreurs, les métriques (CPU, RAM, requêtes HTTP, latence) direct dans Grafana.

**Nginx Proxy Manager** : Interface graphique pour gérer les reverse proxy et les certificats HTTPS Let's Encrypt. Super pratique quand t'as plusieurs services sur un même VPS.

---

## L'infra de prod

VPS chez Infomaniak (Ubuntu 24.04). Dessus y'a un `docker-compose.prod.yml` avec 6 services : PostgreSQL, l'app (image depuis GHCR), Prometheus, Grafana, Loki et Promtail.

J'ai séparé les réseaux Docker pour isoler :
- `public` : app + Grafana (exposés via Nginx Proxy Manager)
- `backend` : app + PostgreSQL (isolé, pas accessible de l'extérieur)
- `monitoring` : toute la stack monitoring entre elle

L'app expose ses métriques sur `/api/metrics` et Prometheus les récupère toutes les 15 secondes.

---

## Les galères (et comment je les ai résolues)

### ESLint qui crashait

Le projet avait `eslint-config-next` en version 0.2.4 qui était pas compatible avec ESLint 10. J'ai viré la config et j'ai tout refait de zéro dans `eslint.config.mjs` avec `@typescript-eslint`. C'était chiant mais au moins maintenant c'est propre.

### Prisma qui plantait au démarrage

Le conteneur tournait en utilisateur non-root (comme il faut en prod), mais `prisma db push` essayait de régénérer le client Prisma et avait pas les droits d'écriture. Le conteneur crashait en boucle. La solution c'était d'ajouter `--skip-generate` vu que le client est déjà généré pendant le build Docker.

### Next.js qui écoutait sur la mauvaise interface

Celui-là m'a bien pris la tête. Prometheus arrivait pas à récupérer les métriques de l'app alors que les deux conteneurs étaient sur le même réseau. En fait Next.js en mode standalone utilise la variable `HOSTNAME` pour savoir où écouter, et Docker définit `HOSTNAME` avec l'ID du conteneur... Du coup le serveur écoutait que sur `http://65b0587cb165:3000` au lieu de `0.0.0.0:3000`. Solution : forcer `HOSTNAME: "0.0.0.0"` dans le docker-compose.

### Le dashboard Grafana qui s'affichait pas

J'avais deux volumes Docker qui se marchaient dessus. Le volume des dashboards JSON écrasait le fichier de provisioning. J'ai séparé les chemins et c'était réglé.


### Le coverage SonarQube

Ça c'est un truc étonnant. Au début SonarQube était en "Passed" alors que j'avais littéralement 0% de coverage. Puis quand j'ai ajouté Vitest avec le coverage (via `@vitest/coverage-v8`), j'ai atteint ~14% sur le code total (~43% sur le code métier en excluant les composants UI). Et là, SonarQube a décidé de passer en "Failed" parce que la Quality Gate par défaut demande 80% de coverage sur le nouveau code. Donc paradoxalement, plus je testais, plus ça échouait 😅

Par manque de temps j'ai préféré configurer la Quality Gate sur SonarQube pour adapter les seuils et exclure du code des metrics plutôt que de rester bloqué dessus. C'est pas idéal mais sur un MVP c'est un compromis acceptable.

---

## La sécurité du Dockerfile

En plus du pipeline, le Dockerfile lui-même est sécurisé :
- Image Alpine (le minimum nécessaire, moins de surface d'attaque)
- npm supprimé en prod (ça élimine des CVE connues)
- Utilisateur non-root (si y'a une faille, l'attaquant a pas les droits root)
- Build multi-stage (l'image finale contient que le strict nécessaire pour tourner)

---

## Ce que j'en retiens

Ce projet m'a fait réaliser que le DevSecOps c'est pas juste "coller des outils de sécurité dans un pipeline". C'est se créer un cadre de travail où on peut avancer vite sans risquer de tout casser. Chaque couche a sa propre protection : le code (lint + tests), les dépendances (npm audit), les secrets (Gitleaks), l'image (Trivy), et le runtime (monitoring).

Les bugs les plus chiants c'était pas dans le code(qui a beaucoup était généré par IA) mais dans l'infra — Docker, les réseaux, les permissions. C'est là qu'on voit que faut comprendre toute la stack, pas juste le framework !

Et honnêtement, maintenant que tout est en place, c'est super confortable. Je push, je regarde le pipeline tourner, et si c'est vert c'est en prod, si c'est rouge on continue de debug !

---

*Alexis Remy — M2 DFS — 2025/2026*
