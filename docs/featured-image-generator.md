# Générateur d'image à la une (OpenAI Images)

Génère une bannière éditoriale 16:9 pour un article d'actualité directement depuis
l'éditeur admin. **Tout est manuel** : rien ne se déclenche sans un clic de l'utilisateur.

## Configuration

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `OPENAI_API_KEY` | Clé OpenAI (génération d'image). **Jamais exposée au client.** | — (requis) |
| `OPENAI_IMAGE_MODEL` | Modèle d'image OpenAI. | `gpt-image-2` |

Ces variables vivent dans `.env` (voir `.env.example`). En l'absence de `OPENAI_API_KEY`,
l'endpoint renvoie une erreur « Configuration du service d'image manquante. » et le bouton
de génération affiche le message dans le bloc d'erreur.

## Style et prompt

Le prompt est **centralisé et stable** dans `lib/ai/featured-image-prompt.ts`
(`buildFeaturedImagePrompt(summary)`). Pour ajuster le rendu (palette, composition,
ton éditorial…), éditer ce fichier — ne pas dupliquer le prompt ailleurs.

Règle importante : **l'IA n'écrit pas le titre dans l'image**. Le titre, le badge et le
logo sont ajoutés **en code** lors du post-traitement (voir plus bas), ce qui garantit un
texte net et lisible.

## Image de référence (optionnelle)

L'utilisateur peut joindre une image (PNG / JPEG / WebP, ≤ 8 Mo). Quand elle est fournie,
l'appel passe par `/v1/images/edits` (au lieu de `/v1/images/generations`) et l'image est
**intégrée naturellement comme élément visuel** : carte flottante, badge, logo ou vignette.
Sans image de référence, on utilise la génération standard.

La validation (type + taille) est faite **côté client** dans le composant et **revérifiée
côté serveur**.

## Post-traitement (sharp)

L'image brute d'OpenAI est normalisée avec [sharp](https://sharp.pixelplumbing.com/) :

1. recadrage / redimensionnement en **1600×900** (16:9) ;
2. **dégradé sombre à gauche** pour la lisibilité du texte ;
3. ajout **en code** du **titre de l'article**, d'un **badge** (catégorie) et du **logo**.

L'IA produit donc uniquement l'illustration ; tout texte « dur » est composé par le serveur.

## Stockage

- **Dev** : disque local dans `public/uploads/featured/` (servi statiquement).
- **Prod** : **Vercel Blob** via `BLOB_READ_WRITE_TOKEN`. Sans ce token, repli sur S3.

L'URL finale (locale ou Blob/S3) est renvoyée au client et injectée dans le champ
`image` de l'article.

## Sécurité

- **Admin uniquement** : les endpoints sont protégés par `requireAdminAuth`.
- La **clé OpenAI n'est jamais exposée au client** — l'appel se fait côté serveur.
- **Rate-limit : 5 requêtes / minute** sur la génération.

## Flux utilisateur

Depuis `/admin/news/[newsId]`, sous le bloc « Image de présentation » :

1. **Générer** — saisir un *résumé visuel* (≤ 280 caractères), éventuellement joindre une
   image de référence, puis cliquer **« Générer l'image à la une »**.
2. **Prévisualiser** — l'aperçu 16:9 s'affiche.
3. **Utiliser / Régénérer** :
   - **« Utiliser cette image »** renseigne le champ image de l'article. Pour un article
     déjà enregistré, l'image est aussi persistée immédiatement
     (`POST …/featured-image/save`). Pour un **nouvel** article (id `new`), elle est juste
     appliquée au formulaire et sauvegardée avec l'article.
   - **« Régénérer »** relance la génération avec les mêmes paramètres.

> Le composant : `components/admin/news/featured-image-generator.tsx`
> (lit l'id de l'article via `useParams()`, clé `newsId`).
