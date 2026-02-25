# 📸 Preuves de validation (Evidence)

Ce dossier contient les captures d'écran attestant du bon fonctionnement du pipeline CI/CD, de la sécurité et du monitoring.

## Captures requises

| Fichier | Description | Statut |
|---------|-------------|--------|
| `ci-pipeline-success.png` | Pipeline GitHub Actions complet au vert (7 jobs) | ⬜ À capturer |
| `security-scan-report.png` | Rapport SonarQube (ou Trivy) montrant l'analyse de sécurité | ⬜ À capturer |
| `app-https.png` | Application accessible en HTTPS avec certificat valide | ⬜ À capturer |
| `monitoring-dashboard.png` | Dashboard Grafana en action avec métriques et logs | ⬜ À capturer |

## Comment capturer

### 1. `ci-pipeline-success.png`
→ Aller sur [GitHub Actions](https://github.com/Yahlex/DevSecOps-Vitall/actions) → Cliquer sur le dernier workflow réussi → Capture d'écran montrant les 7 jobs au vert.

### 2. `security-scan-report.png`
→ Aller sur [SonarQube](https://sonarqube.alexis.remy.mds-nantes.fr) → Projet DevSecOps-Vitall → Capture du tableau de bord (bugs, vulnérabilités, code smells, Quality Gate).

### 3. `app-https.png`
→ Ouvrir [https://vitall.alexis.remy.mds-nantes.fr](https://vitall.alexis.remy.mds-nantes.fr) → Capture montrant l'application + le cadenas HTTPS dans la barre d'URL.

### 4. `monitoring-dashboard.png`
→ Ouvrir [Grafana](https://grafana-vitall.alexis.remy.mds-nantes.fr) → Dashboard "Vitall Monitoring Dashboard V2" → Capture montrant les panels de métriques et logs.

---

> 💡 **Astuce** : Générer du trafic avant la capture Grafana pour avoir des données visibles :
> ```bash
> for i in {1..100}; do curl -s https://vitall.alexis.remy.mds-nantes.fr/api/health > /dev/null; done
> ```
