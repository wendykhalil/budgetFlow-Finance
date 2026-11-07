# BudgetFlow -- Finance Dashboard

**BudgetFlow** est une application web de gestion financière personnelle
qui permet de suivre les revenus, les dépenses et les budgets depuis une
interface simple et moderne.

## 🌐 Application en ligne

-   **Frontend (Vercel)** : https://budget-flow-finance.vercel.app
-   **Backend API (Render)** : https://budgetflow-finance.onrender.com
-   **API Health Check** :
    https://budgetflow-finance.onrender.com/api/health

> L'application est déployée avec Vercel pour le frontend, Render pour
> le backend et MongoDB Atlas pour la base de données.

## ✨ Fonctionnalités

### Espace utilisateur (Client)

-   Tableau de bord avec aperçu de la situation financière.
-   Gestion des transactions (revenus et dépenses).
-   Gestion des budgets.
-   Gestion des catégories.
-   Consultation des statistiques et analyses.
-   Calendrier des opérations.
-   Notifications.
-   Gestion du profil et des paramètres.

### Espace administrateur

-   Tableau de bord d'administration.
-   Gestion des utilisateurs.
-   Consultation et gestion des transactions.
-   Gestion des catégories et des budgets.
-   Rapports et activité de la plateforme.
-   Paramètres d'administration.

### Fonctionnalités techniques

-   Authentification avec JWT.
-   API REST pour les échanges entre le frontend et le backend.
-   Communication temps réel avec Socket.IO lorsque cette fonctionnalité
    est utilisée.
-   Données persistées dans MongoDB.
-   Interface responsive.

## 🧰 Technologies utilisées

### Frontend

-   React 19
-   JavaScript (JSX)
-   Vite
-   Tailwind CSS
-   React Router

### Backend

-   Node.js
-   Express.js
-   MongoDB
-   Mongoose
-   JSON Web Token (JWT)
-   Socket.IO

### Déploiement

-   Vercel -- frontend
-   Render -- backend
-   MongoDB Atlas -- base de données

## 🏗️ Architecture du projet

``` text
budgetFlow-Finance/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   └── ...
│   ├── package.json
│   └── ...
├── docs/
│   └── CHANGELOG_DEV.md
├── src/
├── public/
├── package.json
├── vercel.json
└── README.md
```

Le frontend React est situé à la racine du dépôt. Le backend Express est
organisé dans le dossier `backend/`.

## 🚀 Installation locale

### Prérequis

-   Node.js et npm
-   Un compte MongoDB Atlas ou une instance MongoDB locale

### 1. Cloner le dépôt

``` bash
git clone https://github.com/wendykhalil/budgetFlow-Finance.git
cd budgetFlow-Finance
```

### 2. Installer les dépendances du frontend

Depuis la racine du projet :

``` bash
npm install
```

### 3. Configurer le backend

``` bash
cd backend
npm install
```

Créez le fichier `.env` dans le dossier `backend/`, en vous basant sur
les noms de variables réellement utilisés par la configuration du
backend.

Exemple de configuration à adapter :

``` env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
FRONTEND_ORIGINS=http://localhost:5173
```

**Important :** - Remplacez les valeurs d'exemple par vos propres
valeurs. - Le nom exact de la variable MongoDB doit correspondre à celui
attendu par le code du backend. - Ne partagez jamais votre fichier
`.env`. - N'ajoutez jamais de secrets, mots de passe ou URI de connexion
réels dans Git. - Vérifiez que `.env` est bien ignoré par Git.

### 4. Démarrer le backend

Depuis le dossier `backend/` :

``` bash
npm start
```

Le backend local utilise le port défini dans `PORT` (5000 dans
l'exemple).

### 5. Configurer le frontend

Dans un fichier `.env` à la racine du projet, configurez l'URL de l'API
:

``` env
VITE_API_URL=http://localhost:5000/api
```

Adaptez cette URL si votre backend local utilise un autre port.

### 6. Démarrer le frontend

Depuis la racine du projet :

``` bash
npm run dev
```

Vite affiche l'adresse locale à ouvrir dans le navigateur.

## 🔧 Variables d'environnement

  -----------------------------------------------------------------------
  Variable                Emplacement             Description
  ----------------------- ----------------------- -----------------------
  `VITE_API_URL`          Racine du frontend      URL de base de l'API,
                                                  avec le préfixe `/api`

  `PORT`                  `backend/.env`          Port d'écoute du
                                                  serveur backend

  `FRONTEND_ORIGINS`      `backend/.env`          Origines frontend
                                                  autorisées, séparées
                                                  par des virgules

  `JWT_SECRET`            `backend/.env`          Clé secrète utilisée
                                                  pour signer les tokens
                                                  JWT

  Variable MongoDB        `backend/.env`          URI de connexion
                                                  MongoDB ; utilisez le
                                                  nom exact défini dans
                                                  la configuration du
                                                  backend
  -----------------------------------------------------------------------

Pour la production, `VITE_API_URL` doit pointer vers l'API Render, par
exemple :

``` env
VITE_API_URL=https://budgetflow-finance.onrender.com/api
```

Et `FRONTEND_ORIGINS` doit contenir l'origine du frontend Vercel, sans
`/api` et sans slash final :

``` env
FRONTEND_ORIGINS=https://budget-flow-finance.vercel.app
```

Les variables de production sont configurées dans les tableaux de bord
Vercel et Render, pas dans le dépôt Git.

## ☁️ Déploiement

### Frontend -- Vercel

-   Connecter le dépôt GitHub à Vercel.
-   Sélectionner le projet frontend situé à la racine du dépôt.
-   Framework : Vite.
-   Build command : `npm run build`.
-   Output directory : `dist`.
-   Ajouter `VITE_API_URL` avec l'URL publique du backend.

### Backend -- Render

-   Créer un service Web depuis le même dépôt.
-   Root directory : `backend`.
-   Build command : `npm install`.
-   Start command : `npm start`.
-   Configurer les variables d'environnement nécessaires, notamment la
    connexion MongoDB, `JWT_SECRET` et `FRONTEND_ORIGINS`.

### Base de données -- MongoDB Atlas

-   Créer une base de données MongoDB.
-   Configurer un utilisateur de base de données avec un mot de passe
    fort.
-   Configurer les règles réseau nécessaires pour permettre au backend
    Render de se connecter.
-   Ne jamais publier les identifiants de la base de données.

## 🩺 Vérification de l'API

Pour vérifier que le backend répond, ouvrir :

https://budgetflow-finance.onrender.com/api/health

Une réponse de statut OK indique que l'endpoint de santé de l'API
répond. Cela ne remplace pas un test complet de connexion,
d'authentification et des fonctionnalités de l'application.

## 🔐 Sécurité

-   Les secrets et identifiants doivent rester dans les variables
    d'environnement.
-   Ne jamais committer `.env`, les mots de passe ou les clés JWT.
-   Utiliser des mots de passe forts et uniques pour les comptes de
    service.
-   Limiter les accès réseau MongoDB autant que les contraintes de
    l'hébergement le permettent.
-   Vérifier les origines autorisées du backend avant toute mise en
    production.

## 📝 Journal de développement

Les tâches et évolutions du projet sont documentées dans
[`docs/CHANGELOG_DEV.md`](docs/CHANGELOG_DEV.md).

## 👨‍💻 Auteur

**Mohamed Khalil Wendy**

-   GitHub : https://github.com/wendykhalil
-   LinkedIn : https://linkedin.com/in/mohamed-khalil-wendy-4452a5260/

------------------------------------------------------------------------

*BudgetFlow -- Finance Dashboard.*
