# Guide Utilisateur

LearnChain est une plateforme d'apprentissage décentralisée. Deux types d'utilisateurs : les **étudiants** qui s'inscrivent à des cours et obtiennent des certificats NFT soulbound, et les **formateurs** qui publient des cours et reçoivent les paiements directement sur leur wallet.

## Avant de commencer

1. Installez [MetaMask](https://metamask.io/) et créez ou importez un wallet.
2. Connectez le wallet au réseau LearnChain : RPC `http://localhost:8545`, Chain ID `31337` (pour le développement local) ou Sepolia pour le testnet.
3. Ouvrez l'application et cliquez sur **Connect Wallet** en haut à droite.

## Côté étudiant

### Parcourir le catalogue

La page **Courses** liste tous les cours du registre. Utilisez les contrôles pour filtrer :

- **Recherche** par titre (debounce 300 ms).
- Filtres **All / Free / Paid**.
- **Tri** déroulant (Plus récent, Plus ancien, Prix ↑, Prix ↓).

Cliquez sur une carte pour ouvrir la page de détail.

### La page de détail d'un cours

Un cours LearnChain est organisé comme un cours Coursera :

> **Cours** → **Module 01** → Leçon 1, Leçon 2, … → **Module 02** → …

La page de détail est en deux colonnes. À gauche, un sommaire sticky affiche chaque module sous forme d'accordéon. Chaque module indique son nombre de leçons et son temps total estimé. Cliquez sur l'en-tête d'un module pour le déplier ; cliquez sur une leçon pour la charger dans le panneau principal.

Le panneau principal affiche le titre de la leçon, un temps de lecture estimé et le contenu en texte enrichi (titres, listes, images, blocs de code, citations…).

### S'inscrire

Si un cours a un prix, le bouton **Enroll** dans l'en-tête envoie le prix en ETH directement au contrat. La transaction est signée dans MetaMask. Les cours gratuits s'inscrivent de la même manière sans transfert d'ETH.

### Marquer une leçon comme terminée

Chaque leçon a un bouton **Mark as Complete** en bas. Le basculer met à jour votre progression locale (stockée dans votre navigateur, liée à votre wallet). La sidebar affiche une coche remplie à côté de chaque leçon terminée, et la barre de progression globale en haut de la sidebar suit `X / Y lessons`.

### Déverrouillage séquentiel

Le module N+1 reste **verrouillé** tant que toutes les leçons du module N ne sont pas marquées comme terminées. Les modules verrouillés affichent une icône 🔒 et ne sont pas cliquables. C'est un garde-fou UX pour encourager une progression linéaire — il est uniquement appliqué dans le navigateur, pas par le smart contract.

### Obtenir un certificat

Lorsque toutes les leçons du cours sont cochées, une bannière de complétion apparaît au bas du panneau principal :

> All lessons complete. Earn your certificate.

Le formateur (le wallet qui a créé le cours) appelle ensuite `markComplete` pour votre adresse. Après confirmation de la transaction, vous pouvez voir votre certificat sur la page **Certificates**. Les certificats sont des NFT ERC-721 **soulbound** — ils ne peuvent être transférés, vendus, ni déplacés hors de votre wallet.

### Intégrité du contenu

LearnChain stocke le HTML des leçons sur IPFS et un hash `keccak256` du contenu on-chain. Si le payload IPFS est altéré, le hash ne correspondra plus et la vue affichera une bannière d'alerte :

> ⚠ Content integrity warning — Le contenu de cette leçon n'a pas pu être vérifié. Le contenu peut avoir été altéré. Ne faites pas confiance aux liens externes dans cette leçon.

Si vous voyez cette bannière, traitez la leçon comme non fiable. L'auteur peut corriger en re-uploadant le contenu original.

## Côté formateur

### Publier un cours

La page **Create** propose un flux en trois étapes.

#### Étape 1 — Informations du cours

- **Titre**, **Description**.
- **Prix** en ETH. Mettez `0` pour un cours gratuit.
- **Durée totale estimée** (heures).
- **URL de la vignette** — doit commencer par `https://`. Les URL mixed-content sont rejetées.
- **Niveau** — Beginner, Intermediate ou Advanced.
- **Tags** — jusqu'à 5, séparés par des virgules.

#### Étape 2 — Contenu

Construisez le sommaire en **Modules** contenant des **Leçons**.

Chaque leçon a :

- Un **titre**.
- Une **estimation en minutes**.
- Un **éditeur de texte enrichi** pour le corps de la leçon.

La barre d'outils de l'éditeur propose : gras, italique, souligné, barré, surlignage ; H1–H3 + paragraphe ; listes à puces et numérotées ; citation, bloc de code, ligne horizontale ; alignement gauche/centre/droite ; liens et images.

**Les liens doivent commencer par `https://`.** Les liens `http://` et `javascript:` sont rejetés au niveau de l'éditeur puis du sanitizer.

**Les images doivent commencer par `https://`** ou être inline `data:image/<format>;base64,...`. Toute autre forme est supprimée.

Les modules et leçons peuvent être réordonnés (flèches haut/bas) et supprimés avec un garde-fou Confirm/Cancel inline.

Le panneau de droite affiche un aperçu live du plan au fur et à mesure.

#### Étape 3 — Revue et publication

L'écran de revue affiche un résumé du cours, un avertissement de permanence et l'estimation du nombre de transactions :

> N transactions : 1 create + M modules + L leçons.

Plus L uploads IPFS off-chain pour le contenu des leçons (sans gas).

Cliquer sur **Publish Course** déclenche ce pipeline :

1. Pour chaque leçon : sanitisation du HTML, upload IPFS, calcul `keccak256` des octets sanitisés.
2. Upload du JSON de métadonnées du cours sur IPFS.
3. Signature et envoi de `createCourse(metadataCID, priceWei)`.
4. Pour chaque module : signature et envoi de `addModule(...)`.
5. Pour chaque leçon : signature et envoi de `addLesson(courseId, moduleIndex, title, contentCID, contentHash, minutes)`.

La progression est affichée par phase. En cas de succès, vous êtes redirigé vers la page de détail du nouveau cours.

> **Attention :** la structure du cours est permanente on-chain. Vous pourrez ajouter de nouveaux modules et leçons plus tard via la page Account, mais vous ne pourrez pas éditer ou supprimer les existants.

### Gérer un cours publié

Ouvrez la page **Account** et cliquez sur **Manage** sur un cours que vous enseignez.

- Le formulaire **Add module** envoie `addModule(courseId, title, description)`.
- Pour chaque module existant, un formulaire **Add lesson** héberge un éditeur complet. Le soumettre sanitise le HTML, l'upload sur IPFS, calcule le hash d'intégrité et envoie `addLesson(...)`.

### Marquer un étudiant comme complet

Lorsqu'un étudiant termine toutes les leçons, un CTA de complétion apparaît sur sa page de détail. Comme le contrat exige que le formateur déclenche la complétion, vous devez visiter la même page de détail depuis votre wallet de formateur — le CTA y est alors actif. Une fois `markComplete` confirmé, le propriétaire de la plateforme émet le certificat soulbound.

### Réclamer les paiements

L'ETH des inscriptions est retenu par le contrat jusqu'à ce que le formateur appelle `claimPayment(courseId)`. Le montant en attente est transféré en une seule transaction.

## Thème

Le bouton ☀ / ☾ en haut à droite bascule entre thème sombre et clair. Le choix est sauvegardé dans `localStorage` et appliqué à chaque rechargement.

## Dépannage

- **MetaMask est sur la chaîne N, mais cette app utilise la chaîne 31337** — changez le réseau dans MetaMask vers le réseau LearnChain. Supprimez tout ancien "Localhost 8545" et ajoutez le réseau avec `Chain ID 31337` et `RPC URL http://localhost:8545`.
- **Nonce too high** — la chaîne locale a été redémarrée. Dans MetaMask : Settings → Advanced → Clear activity tab data (reset account).
- **Insufficient funds** — importez un des comptes de test que Hardhat affiche au démarrage (chacun a 10 000 ETH).
- **Avertissement d'intégrité** — le HTML IPFS de la leçon ne correspond plus au hash on-chain. Considérez le contenu comme non fiable ; l'auteur peut re-publier.
