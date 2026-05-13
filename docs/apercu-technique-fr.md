# Aperçu Technique

LearnChain est une plateforme d'e-learning décentralisée construite sur Ethereum. Les formateurs publient des cours on-chain, les étudiants paient directement en ETH, et les certificats de complétion sont émis sous forme de NFT ERC-721 soulbound.

Ce document couvre les briques techniques : les smart contracts, le pipeline de contenu off-chain, l'éditeur de texte enrichi, le modèle de sanitization, et l'UX inspirée de Coursera.

## Stack

| Couche | Technologie |
|---|---|
| Contrats | Solidity ^0.8.24, Hardhat, OpenZeppelin |
| Frontend | React 19, Vite, ethers.js v6, react-router-dom |
| Éditeur | TipTap (StarterKit, Underline, Highlight, TextAlign, Typography, Placeholder, Link, Image, CodeBlockLowlight + lowlight) |
| Sanitization | DOMPurify avec liste blanche stricte |
| Stockage off-chain | IPFS via Pinata (avec repli en `data:` URI quand les clés Pinata ne sont pas configurées) |
| Wallet | MetaMask via `window.ethereum` |

## Hiérarchie d'un cours

Le contrat organise les contenus en **Cours > Module > Leçon** (style Coursera).

- **Cours** — entité de plus haut niveau. Détenu par l'adresse du formateur. Contient un prix, un CID IPFS de métadonnées (titre, description, vignette, niveau, durée estimée, tags) et une liste de modules.
- **Module** — groupe ordonné de leçons à l'intérieur d'un cours. Possède un titre, une description et un `lessonCount` maintenu à jour.
- **Leçon** — unité de contenu. Stocke `title`, `contentIpfsHash` (le CID du HTML sanitisé sur IPFS), `contentHash` (keccak256 du HTML sanitisé pour vérification d'intégrité), `estimatedMinutes` et `lessonIndex`.

Le contrat tient également `totalLessons[courseId]` pour permettre au frontend de calculer la progression sans parcourir chaque module.

### Interface du contrat

```solidity
function createCourse(string ipfsHash, uint256 price) external returns (uint256);
function enroll(uint256 courseId) external payable;
function markComplete(uint256 courseId, address student) external; // formateur uniquement
function claimPayment(uint256 courseId) external;                   // formateur uniquement

function addModule(uint256 courseId, string title, string description) external returns (uint256);
function addLesson(
    uint256 courseId,
    uint256 moduleIndex,
    string title,
    string contentIpfsHash,
    bytes32 contentHash,
    uint256 estimatedMinutes
) external returns (uint256);

function getModule(uint256, uint256)            external view returns (Module);
function getLesson(uint256, uint256, uint256)   external view returns (Lesson);
function getModuleCount(uint256)                external view returns (uint256);
function getLessonCount(uint256, uint256)       external view returns (uint256);
function getTotalLessons(uint256)               external view returns (uint256);
```

`CertificateNFT.sol` hérite de `ERC721 + Ownable` (OpenZeppelin). `transferFrom` et `safeTransferFrom` rejettent toujours avec `"Soulbound: non-transferable"`, donc les certificats émis ne peuvent pas être transférés.

## Stockage du contenu off-chain

Le HTML d'une leçon est trop volumineux pour être stocké on-chain de façon économique. À la place :

1. Le frontend sanitise le HTML de l'éditeur via `sanitizeForStorage` (voir ci-dessous).
2. Les octets sanitisés sont uploadés sur IPFS via `uploadLessonContent` — soit via Pinata si `VITE_PINATA_API_KEY` / `VITE_PINATA_SECRET` sont configurés, soit inline sous forme de `data:text/html;base64,...` en repli.
3. Le frontend calcule `keccak256(toUtf8Bytes(sanitizedHTML))` et transmet le CID et le hash à `addLesson`.

Cela offre une **vérification d'intégrité du contenu** : lorsqu'une leçon est rendue, le frontend re-fetch le CID, re-sanitise le payload et re-calcule le hash. Si le hash ne correspond pas au `contentHash` on-chain, une bannière d'alerte est affichée à l'étudiant :

> ⚠ Avertissement d'intégrité — Le contenu de cette leçon n'a pas pu être vérifié. Le contenu peut avoir été altéré. Ne faites pas confiance aux liens externes dans cette leçon.

## Intégration de TipTap

`frontend/src/components/Editor.jsx` est un éditeur de texte enrichi réutilisable utilisé à la fois dans le flux de publication (`CreateCourse`) et dans le panneau de gestion formateur (`Account`).

Extensions :

- **StarterKit** sans son `codeBlock` natif — remplacé par **CodeBlockLowlight** avec le bundle `common` de lowlight pour la coloration syntaxique.
- **SafeLink** — enveloppe `@tiptap/extension-link` avec un callback `validate` qui rejette toute href qui n'est pas `https://`. `target="_blank"` et `rel="noopener noreferrer"` sont forcés sur chaque ancre produite.
- **SafeImage** — enveloppe `@tiptap/extension-image` avec un override de `setImage` qui rejette tout `src` qui n'est pas `https://` ou `data:image/<png|jpeg|gif|webp|svg+xml>;base64,...`.
- **Underline**, **Highlight**, **TextAlign** (titres + paragraphes), **Typography**, **Placeholder**.

La barre d'outils est groupée par séparateurs : Gras/Italique/Souligné/Barré/Surlignage · H1/H2/H3/P · Liste à puces/Liste numérotée · Citation/Bloc de code/Ligne horizontale · Aligner à gauche/centre/droite · Lien/Image. Les boutons Lien et Image ouvrent une petite popover inline qui valide l'URL avant application.

**Important** : l'éditeur n'expose jamais le HTML brut à son parent. Le callback `onUpdate` passe la sortie à `sanitizeHTML` avant d'invoquer le `onChange` du parent. Le parent ne voit jamais de contenu non sanitisé — défense en profondeur.

## Modèle de sanitization (DOMPurify)

`frontend/src/utils/sanitize.js` est la source unique de vérité pour la sécurité HTML. Deux helpers sont exportés :

- `sanitizeHTML(dirty)` — exécute DOMPurify avec la configuration stricte ; utilisé à chaque rendu et autour de la sortie de l'éditeur.
- `sanitizeForStorage(dirty)` — identique à `sanitizeHTML` plus retrait des commentaires HTML et trim des espaces, pour que deux collages identiques produisent le même hash `keccak256`. À utiliser avant l'upload IPFS ou l'envoi au contrat.

### Liste blanche

```
ALLOWED_TAGS: p, br, div, span, hr, strong, em, u, s, mark, code,
              h1, h2, h3, h4, blockquote, pre, ul, ol, li,
              a, img, table, thead, tbody, tr, th, td
ALLOWED_ATTR: href, src, alt, title, class, target, rel, colspan, rowspan
FORBID_TAGS:  script, style, iframe, form, input, button, object, embed, base
FORBID_ATTR:  gestionnaires on* (onerror, onload, onclick, …), style, "javascript"
ALLOW_DATA_ATTR: false
ALLOWED_URI_REGEXP: https:, data:image/<format>;base64, mailto:, #ancre, /relatif
```

### Hook afterSanitizeAttributes

Même avec la liste blanche, deux passes supplémentaires sont exécutées sur chaque élément :

1. Ancres — toute `href` qui n'est pas `https://`, `mailto:`, ancre interne ou chemin relatif est supprimée. `target="_blank"` et `rel="noopener noreferrer"` sont forcés sur chaque ancre `https://` (empêche les attaques de tab-napping et le `window.opener` inverse).
2. Images — tout `src` qui n'est pas `https://` ou `data:image/<format>;base64,...` entraîne la suppression de l'élément `<img>` entier (on ne laisse pas une `<img>` cassée sans `src`).
3. Chaque attribut `on*` est retiré une seconde fois en passe finale.

### Règle de défense en profondeur

Tout endroit qui manipule du HTML suit la même règle :

> Sanitiser en entrée avant le stockage. Sanitiser à nouveau en sortie avant le rendu. Ne jamais utiliser `dangerouslySetInnerHTML` sans appel à `sanitizeHTML(...)` dans la même expression.

Concrètement :

- L'éditeur TipTap sanitise avant d'exposer son HTML au parent.
- `sanitizeForStorage` s'exécute avant l'upload IPFS.
- `uploadLessonContent` re-sanitise à l'intérieur du helper d'upload.
- `fetchLessonContent` re-sanitise après le fetch depuis IPFS.
- La vue `CourseDetail` sanitise une nouvelle fois juste avant le rendu, dans `dangerouslySetInnerHTML={{ __html: sanitizeHTML(lessonHTML) }}`.

## UX inspirée de Coursera

`CourseDetail.jsx` implémente une mise en page deux colonnes façon Coursera :

- **Bandeau d'en-tête** au-dessus du split : titre du cours, formateur, prix, nombre d'inscrits (depuis les événements `StudentEnrolled`), nombre de modules, nombre total de leçons, heures estimées, niveau, et le CTA S'inscrire / Inscrit / Complété.
- **Sidebar gauche** (280px, sticky en desktop) qui liste les modules sous forme de blocs accordéon. Chaque bloc affiche son numéro, son titre, son aperçu de description, son total estimé en minutes, et un indicateur `terminé/total`. Les modules dépliés exposent leurs leçons avec une marque circulaire de complétion, le titre et l'estimation en minutes par leçon. La leçon active reçoit une bordure gauche de 2px en accent.
- **Déverrouillage séquentiel** uniquement côté UI : le module N+1 est verrouillé (et non cliquable) tant que toutes les leçons du module N ne sont pas terminées. Les modules verrouillés affichent un 🔒. C'est purement un garde-fou UX — le contrat n'impose aucun ordre.
- **Contenu principal** : breadcrumb (Cours / Titre du cours / Module / Leçon), titre de leçon, estimation de temps de lecture, bannière d'alerte d'intégrité si les hashs ne correspondent pas, puis le HTML sanitisé dans un wrapper `.prose`.
- **Contrôles en pied de page** : navigation Précédent / Suivant qui respecte les verrous, et un toggle Marquer comme terminé. Quand toutes les leçons sont cochées, une bannière de complétion propose `Complete Course and Earn Certificate` qui appelle `markComplete` et redirige vers `/certificates`.

La progression par leçon est stockée dans `localStorage` sous la clé
`learnchain_progress_{account}_{courseId}_{moduleIndex}_{lessonIndex}`, ce qui scope la progression au wallet sans coûter de gas.

## Résumé du modèle de menace

La frontière de confiance est : **le wallet du formateur est une entrée utilisateur non fiable**. Tout contenu saisi dans l'éditeur est traité comme hostile :

- XSS via `<script>` / `<iframe>` / gestionnaires d'événements — bloqué par FORBID_TAGS + FORBID_ATTR.
- Tab-napping inverse via liens ajoutés par le formateur — bloqué par `rel="noopener noreferrer"` et `target="_blank"` forcés.
- Contenu mixte / man-in-the-middle via images `http://` — bloqué par la vérification `src` `https://` uniquement.
- Exfiltration via URL `javascript:` — bloquée par la regex d'URI et les validateurs par attribut.
- Altération du contenu off-chain — détectée par le check d'intégrité `keccak256` ; les leçons dont le hash ne correspond pas s'affichent avec une bannière.
- Payloads IPFS non fiables — re-sanitisés dans `fetchLessonContent` puis à nouveau au rendu.

## Développement local

```bash
# Racine du projet
npm install
npx hardhat test                          # 18 tests doivent passer
npx hardhat node                          # dans un terminal
npx hardhat run scripts/deploy.js --network localhost  # écrit contracts.js

# Frontend
cd frontend
npm install
npm run dev                               # http://localhost:5173
```

`scripts/deploy.js` injecte quelques cours de démo (avec un module sur les cours gratuits) pour que le catalogue ne soit pas vide sur une chaîne fraîche.

`bash start.sh` depuis la racine du projet démarre le node, déploie les contrats et lance le frontend en une seule commande.
