# SSH Web Manager

Interface web locale pour parcourir les hosts de `~/.ssh/config` et ouvrir des sessions SSH interactives directement dans le navigateur (xterm.js), avec support multi-sessions par onglets.

## Fonctionnalités

- Liste des hosts lue depuis `~/.ssh/config` (description = commentaire en tête de bloc `Host`)
- Terminal SSH interactif dans le navigateur, plusieurs sessions simultanées par onglets
- Ouverture d'une session dans un vrai terminal (Windows Terminal) au double-clic
- Favoris (persistés en local, non stockés dans le fichier SSH config)
- Éditeur du fichier `~/.ssh/config` intégré
- Explorateur des clés présentes dans `~/.ssh/`
- Historique des connexions/déconnexions
- Thème clair / sombre

## Prérequis

- Node.js
- [pnpm](https://pnpm.io/)
- Windows avec Windows Terminal (`wt.exe`) installé — requis pour l'ouverture de session en terminal externe

## Installation

```bash
pnpm install
```

## Développement

```bash
pnpm dev
```

Lance en parallèle :
- le serveur Next.js sur `http://localhost:9100`
- le serveur WebSocket (`ws-server/`) sur `ws://localhost:4101`, qui fait le pont entre le navigateur et les connexions SSH réelles (via `ssh2`)

## Build / production

```bash
pnpm build
pnpm start
```

## Architecture

- **Next.js** (`app/`) — UI (App Router) + routes API qui lisent/écrivent `~/.ssh/config` et listent les clés de `~/.ssh/`.
- **ws-server** (`ws-server/`) — process Node autonome (lancé via `tsx`, indépendant du serveur Next.js) qui relaie les entrées/sorties du terminal entre le navigateur et une vraie connexion SSH.

Le navigateur communique avec Next.js en HTTP pour la gestion de la config/des hosts, et directement avec le `ws-server` en WebSocket pour la session de terminal elle-même (URL configurable via `NEXT_PUBLIC_WS_URL`, `ws://localhost:4101` par défaut).

## Sécurité

Cette application est conçue pour un usage **strictement local, mono-utilisateur**. Elle peut lire n'importe quel fichier de `~/.ssh/` (y compris les clés privées) et exécuter des commandes locales (`wt.exe ssh <host>`). Aucune route API n'est protégée par authentification — ne pas exposer cette application sur un réseau partagé ou public.
