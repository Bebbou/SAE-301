# Préparation de l'oral : Artemis

Source analysée : branche `jeu-Artemis`, dossier `games/2026/artemis/` du dépôt `arcade`.
Les chemins de fichiers ci-dessous sont relatifs à ce dossier. Les numéros de ligne correspondent à cette branche.

Format de l'oral : 30 min = 5 min de présentation du jeu + 10 min de fonctionnalités techniques + 10 à 15 min de questions.
Chaque membre est noté individuellement : il faut pouvoir répondre seul, sans renvoyer la question à un camarade.

---

## 0. Comment utiliser ce document

1. Lis la section 1 (plan de l'oral) et la section 2 (vue d'ensemble) d'abord.
2. Pour chaque fonctionnalité des sections 3 à 5, vérifie que tu sais : le problème, la solution, le code, pourquoi pas l'alternative.
3. Les sections 6 et 7 sont l'entraînement aux questions. Cache la réponse, réponds à voix haute, compare.
4. La section 8 liste les points faibles du code. Mieux vaut les connaître et les dire que se les voir poser.

Règle d'or pour les questions du jury : une réponse en trois temps. Ce que ça fait, comment c'est codé (nomme le fichier et la fonction), pourquoi ce choix.

---

## 1. Plan de l'oral proposé

### 5 min : le jeu
- Artemis : jeu d'exploration en vue de dessus, sur la Lune, 1 ou 2 joueurs, conçu pour la borne d'arcade (joystick + 6 boutons par joueur).
- But : descendre de niveau en niveau. Le trou vers le niveau suivant est caché sous l'un des cailloux. On casse des cailloux à la pioche pour trouver des pierres lunaires et des potions.
- Dans le noir : seule la torche et quelques sources de lumière (cristaux, lasers) éclairent.
- Ennemis : slime, aliens (un tire), cristal flottant (traverse les murs, tire un rayon).
- Tous les 5 niveaux : une salle sûre (map Tiled), avec une statue à qui on offre des pierres contre des PV. Le décor change de biome (gris, bleu, vert, violet).
- Tutoriel intégré.

### 10 min : trois fonctionnalités techniques (environ 3 min chacune)
1. **Génération procédurale des niveaux** (`generation.js`) : automate cellulaire + parcours en largeur. Original, visuel, facile à expliquer avec un schéma.
2. **Éclairage optimisé pour la borne** (`lumiere.js`) : c'est le morceau le plus original. On a testé Light2D de Phaser (10 FPS sur la borne), puis réécrit un système en "noir gommé" avec un pinceau en dégradé (50 FPS). C'est une vraie démarche d'ingénieur : mesure, hypothèse, remplacement.
3. **Ennemis : pathfinding et machine à états** (`ennemis.js`) : recherche de chemin en largeur sur la grille, détection avec hystérésis, rayon du cristal en trois états.

Si le temps le permet ou si le jury creuse : mémoire des niveaux (`registry`), butin, offrande.

Conseil : prépare un schéma ou un écran de jeu pour chacune. Le jury a deux étudiants de MMI3 : ils aiment voir un résultat avant le code.

---

## 2. Vue d'ensemble de l'architecture

### 2.1 Phaser et les scènes
Phaser est un moteur de jeu 2D en JavaScript. Un jeu est découpé en **scènes** (`Phaser.Scene`), chacune avec un cycle de vie :
- `preload()` : charger les images, sons, cartes.
- `create()` : construire la scène une fois.
- `update(time, delta)` : appelée à chaque image (60 fois par seconde visées).

Dans `index.js`, on déclare toutes les scènes : `selection, menu, infos, gameover, niveau1, niveau2, niveau3, pause, synopsis, choix_mode`. `selection` charge tous les assets et crée toutes les animations une fois pour tout le jeu (`selection.js`, `this.load.spritesheet`, `this.anims.create`), puis lance le menu.

Attention : `niveau2.js` et `niveau3.js` sont des restes du gabarit fourni par l'enseignant (plateformes, `img_perso`). Ils ne servent pas au jeu réel. Voir section 8.

### 2.2 Une seule scène de jeu pour tous les niveaux
Il n'y a pas un fichier par niveau. `niveau1.js` est **relancé** à chaque changement de niveau avec `this.scene.restart({ niveau, arrivee, joueurs })`. Dans `init(data)` (ligne 87), on lit ces paramètres. C'est la scène qui se reconstruit selon le numéro de niveau.

Pourquoi : les niveaux sont générés, donc aucun n'a besoin de son propre fichier. Un seul code, une infinité de niveaux.

### 2.3 Le problème qui en découle : garder la mémoire des niveaux
`scene.restart` détruit tout. Pour retrouver un niveau tel qu'on l'a laissé (cailloux cassés, trou révélé), on stocke un objet "état" par niveau dans `this.registry` (stockage global de Phaser, partagé entre scènes) :

```js
// niveau1.js, create()
const niveaux = this.registry.get("niveaux");
const nouveau = !niveaux[this.niveau];
if (nouveau) {
  niveaux[this.niveau] = safe ? { safe: true, ... } : {
    safe: false,
    grille: generation.genererGrille(LARGEUR_NIVEAU, HAUTEUR_NIVEAU),
    cailloux: null, trou: null, trou_revele: false, montee: null
  };
}
this.etat = niveaux[this.niveau];
```

Et avant de quitter : `sauvegarderEtat()` (ligne 627) recopie les cailloux restants, leurs coups restants, le trou révélé et l'état des cristaux dans `this.etat`.

Logique : `niveaux[n]` existe -> on reconstruit à l'identique ; sinon on génère. La grille est un tableau de booléens, donc légère à stocker : pas besoin de sauvegarder les images.

Point à retenir : les joueurs (PV, stamina, équipement, effets) sont passés via le paramètre `joueurs` de `restart`, pas via le registry. Les pierres lunaires sont, elles, dans le registry (`pierres_lunaires`), car elles sont partagées par l'équipe.

### 2.4 Biome : une fonction pure
`biomes.js` :

```js
export function biomeDuNiveau(niveau) {
  const rang = Math.floor((Math.max(niveau, 1) - 1) / NIVEAUX_PAR_BIOME);
  return BIOMES[rang % BIOMES.length];
}
```

Niveaux 1 à 5 : gris, 6 à 10 : bleu, etc., puis on recommence (`% BIOMES.length`). Comme le biome ne dépend que du numéro du niveau, on ne le sauvegarde pas : on le recalcule. C'est un choix de simplicité (moins d'état à garder = moins de bugs).

### 2.5 Fichiers et responsabilités
| Fichier | Rôle |
|---|---|
| `niveau1.js` | Scène de jeu : joueurs, caméra, pioche, laser, passages, update |
| `generation.js` | Génération de la grille de grotte et choix des tuiles de mur |
| `lumiere.js` | Obscurité et lumières (4 modes, "degrade" actif) |
| `ennemis.js` | Types, apparition, pathfinding, tirs, rayon du cristal |
| `cristaux.js`, `pierres.js`, `bonus.js`, `butin.js` | Objets du monde |
| `salle_safe.js`, `offrande.js` | Salle de temple Tiled, statue |
| `biomes.js` | Décor selon le niveau |
| `fonctions.js` | Touches, joueurs, profondeurs, HUD, polices |

Un principe visible partout : les modules exportent des **fonctions qui reçoivent `scene`**, plutôt que des classes. `import * as ennemis from "./ennemis.js"` puis `ennemis.majEnnemis(this)`. Ça découpe le fichier énorme `niveau1.js` sans compliquer l'architecture.

### 2.6 Notions Phaser à maîtriser pour les questions simples
- **Arcade Physics** : hitbox rectangulaires (AABB), pas de rotation, rapide. Choisi car vue de dessus, gravité à 0 (`index.js`).
- **`collider` vs `overlap`** : collider = les deux objets se bloquent ; overlap = on détecte le chevauchement sans blocage (ex. un ennemi qui touche un joueur lui inflige des dégâts, mais ne le pousse pas).
- **Groupe statique** (`staticGroup`) : objets qui ne bougent pas (cailloux, cristaux), moins coûteux pour la physique.
- **`delta`** : temps écoulé depuis la dernière image en ms. On calcule `secondes = delta / 1000` et on multiplie les consommations par `secondes` (ex. `STAMINA_CONSO * secondes`). Ainsi le comportement ne dépend pas du nombre d'images par seconde : sur une machine lente, la stamina baisse à la même vitesse réelle.
- **Tweens** : animations de valeurs (position, alpha, échelle) gérées par Phaser, ex. le tremblement d'un caillou touché.
- **Profondeur = y** : `setDepth(sprite.y)`. En vue de dessus, ce qui est plus bas à l'écran passe devant. D'où le fait que HUD, projectiles, obscurité aient des profondeurs bien plus grandes (`PROFONDEUR` dans `fonctions.js`).
- **`JustDown`** : vrai une seule fois à l'appui, contrairement à `isDown` qui reste vrai tant que la touche est tenue. Utilisé pour les actions ponctuelles (frapper, changer d'équipement).
- **Touches** : `TOUCHES_J1` / `TOUCHES_J2` dans `fonctions.js`. Les touches clavier correspondent aux boutons de la borne ; à l'écran on affiche la lettre inscrite sur le bouton (`ETIQUETTES`), pas la touche du clavier.
- **Deux caméras** : le zoom grossit tout ce que filme la caméra principale, HUD compris. On crée donc une seconde caméra sans zoom qui ne filme que le HUD (`creerCameraHud`, ligne 284). Chaque objet est assigné à une seule caméra avec `camera.ignore`.

---

## 3. Fonctionnalité 1 : génération procédurale des grottes

Fichier : `generation.js`. Fonction d'entrée : `genererGrille(largeur, hauteur)`, ligne 36.

### 3.1 Le problème
Faire des niveaux différents à chaque partie, qui ressemblent à des grottes (formes arrondies, pas des rectangles), et **dont tout est accessible** : un niveau avec une zone isolée où se trouve le trou serait injouable.

### 3.2 La solution en trois étapes

**Étape 1 : bruit aléatoire.** Chaque case est un mur avec 45 % de chances.

```js
function remplirAuHasard(largeur, hauteur) {
    return creerGrille(largeur, hauteur, (x, y) => Math.random() < PROBA_MUR);
}
```

**Étape 2 : lissage (automate cellulaire).** 5 passes. À chaque passe, on regarde les 8 voisines de chaque case :

```js
function lisser(grille) {
    return creerGrille(grille[0].length, grille.length, (x, y) => {
        if (estBordure(grille, x, y)) return true;
        let murs_voisins = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if ((dx !== 0 || dy !== 0) && !estSol(grille, x + dx, y + dy)) murs_voisins++;
            }
        }
        return murs_voisins > 4 || (murs_voisins === 4 && grille[y][x]);
    });
}
```

Règle : plus de 4 voisines murs -> la case devient mur ; moins de 4 -> sol ; exactement 4 -> elle ne change pas. Effet : les cases isolées disparaissent, les amas se soudent, on obtient des cavernes. C'est le principe du "jeu de la vie" appliqué à des grottes (c'est une technique classique de génération de donjons).

Détails à connaître :
- `lisser` construit une **nouvelle** grille au lieu de modifier l'ancienne. Si on modifiait en place, les cases déjà lissées influenceraient les suivantes dans la même passe, et le résultat dépendrait de l'ordre de parcours.
- `estSol` renvoie `false` hors de la grille : hors limites, on considère qu'il y a du mur. Ça évite d'avoir à tester les bords partout.
- `BORDURE = 3` : les 3 cases du pourtour sont toujours des murs (3 = hauteur d'un mur nord complet à l'écran).

**Étape 3 : ne garder que la plus grande zone.** Après lissage, il peut rester plusieurs poches de sol séparées. Un **parcours en largeur** (BFS) identifie chaque zone ; on garde la plus grande et on remplit le reste en mur.

```js
function plusGrandeZone(grille) {
    const vue = creerGrille(grille[0].length, grille.length, () => false);
    let plus_grande = [];
    grille.forEach((ligne, y) => ligne.forEach((mur, x) => {
        if (mur || vue[y][x]) return;
        const zone = [];
        const file = [[x, y]];
        vue[y][x] = true;
        while (file.length > 0) {
            const [cx, cy] = file.shift();
            zone.push([cx, cy]);
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                const nx = cx + dx, ny = cy + dy;
                if (estSol(grille, nx, ny) && !vue[ny][nx]) {
                    vue[ny][nx] = true;
                    file.push([nx, ny]);
                }
            });
        }
        if (zone.length > plus_grande.length) plus_grande = zone;
    }));
    return plus_grande;
}
```

Explication du BFS : on part d'une case de sol non visitée, on met ses voisins (haut, bas, gauche, droite) dans une file, on les traite dans l'ordre d'arrivée, et on marque les cases `vue` pour ne jamais les revisiter. Quand la file est vide, on a toute la zone connexe. On compare sa taille avec la meilleure trouvée.

Garantie obtenue : toutes les cases de sol restantes sont reliées entre elles. Donc le trou et l'échelle (placés ensuite sur des cases de sol) sont atteignables.

### 3.3 La boucle de sécurité
`genererGrille` recommence jusqu'à 20 fois (`NB_ESSAIS_MAX`) si la zone jouable fait moins de 35 % de la grille (`PART_SOL_MIN`). Si aucun essai n'est assez bon, elle renvoie le moins mauvais. Sans ça, on pourrait tomber sur un niveau minuscule.

### 3.4 De la grille aux tuiles
`tuileMur(grille, x, y)` (ligne 54) choisit l'image d'une case de mur selon où se trouve le sol autour. Exemple : si le sol est à 1, 2 ou 3 cases au sud, c'est un mur "de face" (briques) et la rangée (bas, haut, rebord) dépend de la distance. Sinon on regarde les côtés, puis les coins, sinon c'est de la roche pleine (`TUILES.plein`).

Dans `niveau1.js` (lignes 146-158), la grille est traduite en deux calques :

```js
grille.forEach((ligne, y) => ligne.forEach((mur, x) => {
  if (mur) calque_murs.putTileAt(generation.tuileMur(grille, x, y), x, y);
  else calque_sol.putTileAt(generation.TUILES.sol, x, y);
}));
calque_murs.setCollisionByExclusion([-1]); // toute tuile non vide est solide
```

`setCollisionByExclusion([-1])` : toutes les tuiles sauf l'index -1 (vide) sont solides. C'est ce qui rend les murs infranchissables, sans coder chaque case.

### 3.5 Optimisation du décor : `figerDecor`
(`niveau1.js`, ligne 276) Un niveau fait 50 x 34 cases. Phaser redessine chaque tuile visible à chaque image, en JavaScript, ce qui coûte cher sur la borne. Le décor ne change jamais, donc on le dessine **une fois** dans une `renderTexture` (une image), puis on cache les calques. Les calques restent dans la scène car on s'en sert pour les collisions, la torche et le placement des objets : seul leur affichage est coupé.

### 3.6 Pourquoi ce choix plutôt qu'un autre
- **Niveaux dessinés à la main sous Tiled** : bien plus de contrôle, mais un nombre fini de niveaux et beaucoup de travail. On l'a fait seulement pour la salle sûre, qui est unique.
- **Bruit de Perlin** : donne aussi des formes organiques, mais il ne garantit pas la connexité ; il faudrait quand même un BFS. L'automate est plus simple (quelques lignes) et suffit.
- **Algorithme de labyrinthe** (backtracker) : couloirs étroits, pas des cavernes.

### 3.7 Limites à admettre si on te les demande
- `file.shift()` est en O(n) sur un tableau JavaScript. Sur une grille de 1700 cases ça n'a pas d'impact visible, et la génération n'a lieu qu'une fois par niveau. Une vraie file (index de tête) serait plus propre.
- Aucune garantie sur la forme du niveau, seulement sur la connexité. Un niveau peut être assez "couloir".
- `Math.random()` n'est pas seedé : on ne peut pas rejouer le même niveau à partir d'une graine. Pour la mémoire, on stocke la grille entière.

---

## 4. Fonctionnalité 2 : l'éclairage et l'optimisation pour la borne

Fichier : `lumiere.js` (463 lignes). Mode actif choisi ligne 27 : `const MODE = "degrade";`.

### 4.1 Le problème
Le jeu est dans le noir. Il faut : un halo autour des joueurs, un cône de torche qui s'arrête aux murs, des lueurs pour les cristaux, lasers, potions, tirs d'aliens et impacts. Et ça doit tourner sur la borne, un Raspberry Pi 4 (GPU V3D, faible).

### 4.2 Les trois systèmes essayés (l'historique est un argument)
1. **"ancien"** : une image noire par-dessus l'écran, et on y "gomme" des cercles concentriques d'opacités différentes. Cercles par paliers, résultat peu joli.
2. **"light2d"** : le système de lumières de Phaser. Joli, mais lourd : le shader fait `maxLights` tours de boucle **par pixel**, même avec moins de lumières (commentaire dans `index.js`). Sur la borne : environ 10 FPS.
3. **"degrade"** (retenu) : même principe que l'ancien (noir gommé), mais avec un pinceau en dégradé. Environ 50 FPS sur la borne.

Les quatre modes coexistent dans le code via la constante `MODE`, ce qui a permis de **comparer** à nombre d'images égal. Il existe aussi un mode "aucune" (aucune obscurité) pour mesurer le coût de la lumière en soi, et un banc d'essai (`BENCH_AUTO`, `PHASES_BENCH` dans `niveau1.js`) qui coupe un poste à la fois (teintes, noir, torche, ennemis) et mesure la moyenne des FPS. C'est de la démarche de mesure : on n'optimise pas au hasard.

À dire à l'oral : "nous avons mesuré sur la borne et pas sur PC, car le GPU du Pi n'a rien à voir avec celui d'un ordinateur."

### 4.3 Principe du mode "degrade" (les trois étapes de l'en-tête du fichier)
1. Une grande image noire couvre l'écran (`scene.obscurite`, une `RenderTexture`).
2. Pour chaque source de lumière, on place une copie d'une **image de dégradé radial** (un disque blanc qui s'estompe vers le bord) à la bonne position, taille et opacité. Ce sont les "pinceaux".
3. On **gomme** (`erase`) tous les pinceaux dans le noir d'un seul appel. Là où on a gommé, le jeu redevient visible.

```js
// majDegrade(), fin de la fonction (ligne 408 et suivantes)
scene.obscurite.clear();
scene.obscurite.fill(COULEUR_NOIR, OPACITE_NOIR);
scene.obscurite.erase(scene.pinceaux.slice(0, scene.nb_pinceaux));
```

Il n'y a **aucun calcul de lumière par pixel**. Tout le coût est : dessiner N images (N = nombre de lumières, une dizaine). C'est ce qui explique le gain.

### 4.4 L'image du pinceau, créée une fois (ligne 355)

```js
function creerTextureDegrade(scene) {
  if (scene.textures.exists("degrade_lumiere")) return;
  const taille = 256;
  const canvas = scene.textures.createCanvas("degrade_lumiere", taille, taille);
  const ctx = canvas.getContext();
  const degrade = ctx.createRadialGradient(taille/2, taille/2, 0, taille/2, taille/2, taille/2);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    degrade.addColorStop(t, "rgba(255,255,255," + Math.pow(1 - t * t, 2).toFixed(3) + ")");
  }
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, taille, taille);
  canvas.refresh();
}
```

- Un `canvas` HTML5 dessiné en code : aucun fichier d'image à charger.
- Opacité `(1 - t²)²` avec `t` de 0 (centre) à 1 (bord). Pourquoi cette courbe : elle est plus large au centre qu'un simple `(1 - t)²`, donc les lumières de la torche se fondent en un faisceau continu au lieu de taches séparées.
- `if (scene.textures.exists(...)) return` : la texture est partagée par tout le jeu, on ne la recrée pas à chaque niveau.

### 4.5 Réutilisation des objets : `pinceau()` (ligne 389)
```js
if (!scene.pinceaux[i]) scene.pinceaux[i] = scene.make.image({ key: "degrade_lumiere" }, false);
scene.pinceaux[i].setPosition(...).setDisplaySize(...).setAlpha(Math.min(force, 1));
```
Les images-pinceaux sont créées **une fois** puis réutilisées d'une image à l'autre (tableau `scene.pinceaux`, compteur `nb_pinceaux` remis à 0 à chaque image). Raison : créer et détruire des objets à 60 images par seconde déclenche le ramasse-miettes (garbage collector) du navigateur, qui provoque des saccades. `scene.make.image(..., false)` : le `false` signifie "ne pas l'ajouter à la scène" : l'image n'est jamais affichée, elle sert seulement de gomme.

### 4.6 Trois astuces de performance
1. **Noir à demi-résolution** (`ECHELLE_NOIR = 0.5`, ligne 372). Le noir est dessiné à 640x360 puis agrandi par `setScale(1 / ECHELLE_NOIR)` avec un filtre doux (`FilterMode.LINEAR`). Comme le noir n'est qu'un dégradé flou, on ne voit presque pas la différence, mais il y a 4 fois moins de pixels à remplir et à gommer. Le filtre `LINEAR` est nécessaire car `pixelArt: true` impose normalement `NEAREST`, qui donnerait de gros carrés.
2. **Teintes à part.** La gomme n'a pas de couleur. Pour colorer la lumière (torche orangée, cristaux colorés), chaque lumière pose aussi une image colorée en mélange `MULTIPLY` juste sous le noir. Multiplier ne délave pas l'image (contrairement à une lueur additive). Les teintes couvrent 70 % de la zone (`ECHELLE_TEINTE`) pour mélanger moins de pixels.
3. **Un seul appel d'`erase`** avec le tableau de tous les pinceaux, au lieu d'un appel par lumière.

### 4.7 Le cône de la torche : lancer de rayons
Pour que la torche s'arrête aux murs, `distanceMur` (ligne 100) avance pas à pas dans la direction du regard :

```js
function distanceMur(scene, joueur, portee) {
  const x = joueur.sprite.body.center.x;
  const y = joueur.sprite.body.center.y;
  let distance = 0;
  while (distance < portee && !scene.calque_murs.hasTileAtWorldXY(x + joueur.regard.x * distance, y + joueur.regard.y * distance)) {
    distance += PAS_RAYON; // 8 px
  }
  return Math.max(distance, DISTANCE_MIN_TORCHE);
}
```

C'est du **ray marching** simplifié : on teste un point tous les 8 px jusqu'à toucher une tuile de mur ou atteindre la portée. Pas de calcul géométrique d'intersection : on interroge la grille de tuiles directement (`hasTileAtWorldXY`).

Puis la torche est une **chaîne de 3 pinceaux** (`TORCHE_DEGRADE`) placés devant le joueur à 10 %, 30 % et 60 % de la distance au mur, de plus en plus larges et de plus en plus faibles. Le rayon grandit avec la distance, ce qui donne un faisceau qui s'évase comme un cône. Les valeurs ont été calculées numériquement (commentaire du code) pour que la luminosité décroisse sans trou ni bosse jusqu'à environ 260 px.

L'ancien système dessinait un vrai polygone de 15 rayons (`pointsDuCone`, `dessinerCone`). Plus fidèle géométriquement, mais plus coûteux, et on voit des paliers.

### 4.8 Questions d'honnêteté
- "Pourquoi garder trois modes qui ne servent plus ?" : pour comparer et mesurer. On peut basculer en changeant une constante. Mais admets que c'est du code mort à nettoyer.
- "Les chiffres 10 et 50 FPS viennent d'où ?" : mesures faites sur la borne avec le compteur de FPS intégré (`AFFICHER_FPS`) et le banc d'essai automatique. Vérifie les chiffres exacts avant l'oral, sur la borne ou avec ton propre relevé, pour ne pas en citer de faux.
- "Pourquoi `maxLights: 6` dans `index.js` ?" : avec Light2D, le shader boucle `maxLights` fois par pixel. 2 joueurs x (1 halo + 2 lumières de torche) = 6. Réduire de 10 à 6 réduit le coût. Ce réglage ne sert plus qu'au mode `light2d`.

---

## 5. Fonctionnalité 3 : les ennemis (pathfinding et machines à états)

Fichier : `ennemis.js`.

### 5.1 Données : types d'ennemis en table
`TYPES` (ligne 20) décrit chaque ennemi par des **données** et non par du code spécifique : sprite, PV, vitesse, dégâts, hitbox, et une fonction `poids(niveau)` pour la probabilité d'apparition.

```js
alien_rouge: { ..., pv: 5, vitesse: 95, degats: 20, poids: (niveau) => (niveau >= 3 ? 35 : 0), ... },
cristal: { ..., poids: (niveau) => (niveau >= 4 ? 30 : 0), traverse: true, rayon: true, brille: true }
```

Pourquoi : ajouter un ennemi = ajouter une ligne, pas une classe. `poids` donne la **difficulté progressive** : le slime dès le niveau 1, l'alien vert dès 2, le rouge dès 3, le cristal dès 4.

Tirage pondéré (`tirerType`, ligne 297) : on additionne les poids, on tire un nombre au hasard dans cette somme, et on soustrait les poids un à un jusqu'à passer sous zéro. Même technique pour les potions dans `bonus.js` (`tirerPotion`).

```js
let reste = Math.random() * noms.reduce((total, nom) => total + TYPES[nom].poids(niveau), 0);
for (const nom of noms) {
  reste -= TYPES[nom].poids(niveau);
  if (reste < 0) return nom;
}
```

Difficulté croissante aussi : un ennemi de plus tous les 3 niveaux (jusqu'à 7), +1 PV tous les 10 niveaux (`NIVEAUX_PAR_BONUS_PV`).

### 5.2 Le pathfinding : BFS sur la grille
`chercherChemin(bloquees, largeur, hauteur, depart, arrivee)`, ligne 76.

- Le monde est vu comme une grille de cases de 32 px (`TAILLE_CASE`). `casesBloquees` (ligne 66) construit un `Set` de clés `"x,y"` : murs (depuis `etat.grille`), cailloux et cristaux.
- BFS à partir de la case de l'ennemi. Pour chaque case, on explore 8 voisins. `precedent` est une `Map` qui sert **à la fois** de liste des cases visitées et de mémoire du parent de chaque case.
- À l'arrivée, on reconstruit le chemin en remontant les parents (`precedent.get(...)`), avec `unshift` pour l'avoir dans l'ordre départ -> arrivée.
- **Pas de coin coupé** : en diagonale, les deux cases adjacentes doivent aussi être libres, sinon l'ennemi frotterait un coin de mur et se bloquerait.

```js
if (dx !== 0 && dy !== 0 &&
   (bloquees.has(cle(courant.x + dx, courant.y)) || bloquees.has(cle(courant.x, courant.y + dy)))) continue;
```

Pourquoi BFS plutôt que A* ou Dijkstra : tous les déplacements ont le même coût, la grille est petite, et le BFS est simple et garanti de trouver un chemin s'il existe. A* serait plus rapide sur de grandes cartes grâce à une heuristique (distance estimée au but), mais le gain serait invisible ici.

Nuance honnête : le BFS minimise le **nombre de cases**, pas la distance réelle. Une diagonale compte autant qu'un pas droit alors qu'elle est 1,41 fois plus longue. Le chemin trouvé n'est donc pas toujours le plus court en distance. Dijkstra/A* avec coût 1,41 en diagonale corrigerait ça.

### 5.3 Boucle de comportement : `majEnnemis` (ligne 172)
Pour chaque ennemi, à chaque image :
1. Trouver le joueur **debout** le plus proche (`joueursEnJeu()`, un joueur à terre n'est plus une cible).
2. **Alerte avec hystérésis** : l'ennemi repère à 300 px (`RAYON_DETECTION`) mais ne lâche qu'à 450 px (`RAYON_ABANDON`).
   ```js
   if (distance <= RAYON_DETECTION) ennemi.alerte = true;
   else if (distance > RAYON_ABANDON) ennemi.alerte = false;
   ```
   Pourquoi deux seuils : avec un seul, un joueur qui se tient exactement à la limite ferait clignoter l'état alerte/repos à chaque image. Les deux seuils créent une zone tampon (hystérésis).
3. Recalcul du chemin **toutes les 400 ms** seulement (`DELAI_CHEMIN`), pas à chaque image : un BFS par ennemi et par image serait gaspillé, le joueur ne change pas assez vite de case.
4. Suivi du chemin : on retire les points déjà atteints (distance < 6 px), puis on se dirige vers le prochain. Dans la même case que le joueur, ou sans chemin, on fonce droit sur lui.
5. Vitesse = direction normalisée x vitesse du type. `normalize()` évite d'aller plus vite en diagonale.

### 5.4 Le tireur (alien vert)
Il tire s'il est à portée (300 px) et en **ligne de vue** (`ligneDeVue`, ligne 308 : on teste un point tous les 16 px entre lui et le joueur, s'il y a un mur il ne tire pas). Il s'arrête à 190 px (`DISTANCE_TIR`) au lieu de venir au contact. Le tir part après une animation de visée de 450 ms, vers la position du joueur **à ce moment-là** (`viser`), donc un joueur qui bouge peut esquiver.

### 5.5 Le cristal : machine à états
`majCristal` (ligne 236). Trois états dans `ennemi.etat_rayon` :
- `"repos"` : il flotte vers le joueur (traverse les murs, `traverse: true`). Si le joueur est à moins de 320 px et que le délai est écoulé -> `"charge"`.
- `"charge"` (1 s) : immobile, une ligne fine clignote et suit le joueur. À la fin, la direction est **verrouillée**. Se déplacer pendant la charge suffit à esquiver.
- `"tir"` (0,5 s) : le rayon part dans la direction verrouillée. Dégâts si la ligne coupe la hitbox du joueur (`Phaser.Geom.Intersects.LineToRectangle`).

Retour à `"repos"` avec un délai de 4 s avant la prochaine charge. Un coup reçu pendant la charge l'interrompt.

Pourquoi une machine à états : le comportement dépend du moment présent dans un cycle. Un état explicite évite des enchaînements de booléens ingérables. Et le temps est géré par comparaison avec `scene.time.now` (`ennemi.fin_etat`) plutôt que par des `setTimeout`, ce qui reste cohérent quand le jeu est mis en pause.

Le bout du rayon (`boutDuRayon`, ligne 285) avance de 8 px jusqu'à une case bloquée. Subtilité : le cristal peut se trouver **dans** un mur (il les traverse), donc un obstacle ne compte qu'une fois sorti du mur (variable `libre`).

### 5.6 Dégâts du joueur : invulnérabilité
`degatsJoueur` (ligne 375) : après un coup, 1 s d'invulnérabilité (`INVULNERABILITE_JOUEUR`), le sprite clignote (tween alpha) et la caméra tremble (`cameras.main.shake`). Sans ça, un ennemi au contact enlèverait des PV à chaque image (60 fois par seconde) puisque l'`overlap` se déclenche à chaque image.

---

## 6. Autres mécaniques à pouvoir expliquer en 1 minute

### 6.1 Pioche et frappe (niveau1.js `commencerFrappe` ligne 538, `frapper` ligne 551)
- Appui sur le bouton -> animation de coup. Le dégât n'est appliqué qu'à la **frame d'impact** (`FRAME_IMPACT_PIOCHE = 2`), pour que le coup soit synchronisé avec l'animation. Dans `majJoueur` : `if (!j.frappe.touche && j.sprite.anims.currentFrame.textureFrame >= FRAME_IMPACT_PIOCHE)`.
- `frappe.touche` évite de frapper plusieurs fois pendant la même animation.
- La zone de frappe est un petit rectangle (`Phaser.Geom.Rectangle`) devant les pieds du joueur, dans la direction du regard (figée au début du coup). On teste le chevauchement avec les hitbox des ennemis, cristaux et cailloux.
- Un caillou demande 3 coups (`COUPS_CAILLOU`), un cristal 5.

### 6.2 Hitbox réduite aux pieds
`j.sprite.setSize(12, 6); setOffset(10, 26)` : la hitbox est limitée aux pieds. Pourquoi : en vue de dessus avec profondeur, le joueur peut passer "derrière" le haut d'un caillou ; seule la base bloque. Pareil pour cailloux (`setSize(24, 15)`) et cristaux. Conséquence : la torche part du centre du sprite (`origineTorche`) mais la distance au mur se mesure depuis les pieds, comme les collisions.

### 6.3 Caméra et zoom adaptatif (niveau1.js lignes 467-503)
- La caméra suit une `zone` invisible placée au milieu des joueurs (`placerCible`).
- `zoomVoulu` : zoom maximal (1,5) tant que les joueurs tiennent à l'écran avec une marge, sinon on dézoome jusqu'à 0,7. `Phaser.Math.Clamp` borne le résultat.
- `majZoom` : `Phaser.Math.Linear(camera.zoom, cible, 0.08)` rattrape 8 % de l'écart à chaque image : transition douce (interpolation linéaire, effet d'amorti).
- `limiterAEcran` : filet de sécurité, aucun joueur ne sort de l'écran en duo.

### 6.4 Butin (butin.js)
Un objet lâché saute vers un point voisin (qui n'est pas dans un mur : 10 essais), rebondit (`ease: "Bounce.easeOut"`), flotte, puis est **attiré** par le joueur à moins de 56 px (`RAYON_AIMANT`) et ramassé à moins de 12 px. Chaque type d'objet fournit sa fonction `ramasser(scene, joueur)` : le butin ne sait pas ce qu'il contient (principe de délégation, pierre et potion utilisent le même code).

### 6.5 Passages et coopération (majPassages, ligne 801)
Pour changer de niveau en duo, **tous** les joueurs debout doivent être près du passage, puis l'un d'eux appuie. Le texte affiche `descendre 1/2` tant que tout le monde n'est pas là. Un joueur à terre ne bloque pas.

### 6.6 Joueur à terre et statue
Un joueur à 0 PV est "à terre" (`estMort`) : grisé, immobile, ignoré des ennemis. Seule l'offrande à la statue le relève (`recevoirOffrande`). La partie est perdue quand tous sont à terre. Le prix de l'offrande monte avec le niveau (`coutOffrande`, ligne 599) : 5 pierres pour 25 PV, +5 tous les 5 niveaux.

### 6.7 Mode 2 joueurs sans duplication
`fct.JOUEURS` est un tableau de définitions ; `niveau1.js` fait `fct.JOUEURS.slice(0, nb_joueurs).map(creerJoueur)`. Chaque joueur est un objet qui regroupe tout (sprite, touches, PV, torche, effets). Tout le code manipule `this.joueurs` avec des `forEach`, jamais "joueur1" ou "joueur2" en dur. Ajouter un 3e joueur reviendrait à ajouter une ligne dans le tableau.

---

## 7. Questions probables, avec réponses

Classées du simple au difficile. Cache la réponse et essaie d'abord.

### Niveau simple

**Q1. C'est quoi Phaser ? Pourquoi l'avoir choisi ?**
Un moteur de jeu 2D en JavaScript qui gère rendu, physique, animations, entrées et audio. Choisi car imposé par le cadre de la SAE (le dépôt `arcade` charge des jeux Phaser) et parce qu'on connaît le JavaScript.

**Q2. Quelle est la différence entre `preload`, `create` et `update` ?**
`preload` charge les ressources avant le démarrage, `create` construit la scène une fois, `update` tourne à chaque image. Chez nous le chargement est centralisé dans la scène `selection`, et `niveau1.create` est rappelé à chaque changement de niveau.

**Q3. Pourquoi `gravity.y = 0` ?**
Le jeu est en vue de dessus : pas de chute. Les déplacements sont donc des vitesses dans les 4/8 directions.

**Q4. C'est quoi le `delta` dans `update(time, delta)` ?**
Le temps écoulé depuis la dernière image, en ms. On l'utilise pour des consommations continues (stamina, durée des effets) afin qu'elles soient indépendantes du nombre d'images par seconde.

**Q5. Comment sont gérées les touches des deux joueurs ?**
Deux tables `TOUCHES_J1` et `TOUCHES_J2` dans `fonctions.js` associent une action (haut, torche, frapper_tirer...) à une touche clavier. `creerTouches` les convertit en objets `Phaser.Key` avec `addKeys`. Le code de jeu lit `j.touches.sprint.isDown`, sans savoir quelle touche c'est : changer la configuration ne touche qu'un fichier.

**Q6. Pourquoi une hitbox plus petite que le sprite ?**
Pour l'effet de profondeur en vue de dessus : on peut passer derrière le haut d'un caillou, et seuls les pieds touchent les murs. Voir 6.2.

**Q7. Pourquoi `isDown` pour marcher et `JustDown` pour frapper ?**
Marcher est continu tant que la touche est tenue. Frapper est ponctuel : un appui = un coup, sinon tenir la touche déclencherait un coup par image.

### Niveau moyen

**Q8. Explique ta génération de niveau.**
Section 3 en trois phrases : bruit à 45 %, 5 lissages par automate cellulaire (une case devient mur si plus de 4 voisines sont des murs), puis BFS pour ne garder que la plus grande zone. Le BFS garantit que tout est accessible. Si la zone est trop petite (< 35 %), on recommence jusqu'à 20 fois.

**Q9. Pourquoi créer une nouvelle grille à chaque passe de `lisser` ?**
Pour que toutes les cases soient calculées à partir du même état précédent. En place, une case déjà modifiée influencerait ses voisines dans la même passe, et le résultat dépendrait de l'ordre de parcours.

**Q10. Comment garde-t-on l'état d'un niveau quand on remonte ?**
`this.registry` (stockage global Phaser) contient `niveaux[n]`. Avant de quitter, `sauvegarderEtat` y recopie cailloux, coups restants, trou révélé, cristaux. Au retour, `niveaux[n]` existe donc on reconstruit à partir de lui au lieu de regénérer. Voir 2.3.

**Q11. Quelle est la différence entre `collider` et `overlap` ? Un exemple chez vous.**
Collider : les corps se bloquent (joueur / mur, joueur / caillou). Overlap : on détecte le chevauchement sans bloquer (ennemi / joueur : dégâts, laser / ennemi : dégâts et disparition du laser).

**Q12. Comment les ennemis trouvent-ils leur chemin ?**
Section 5.2 : BFS sur la grille de cases de 32 px, 8 directions sans couper les coins, recalculé toutes les 400 ms. Les murs viennent de `etat.grille`, les cailloux et cristaux sont ajoutés aux cases bloquées.

**Q13. Pourquoi recalculer le chemin seulement toutes les 400 ms ?**
Un BFS par ennemi et par image serait coûteux et inutile : le joueur change rarement de case en 400 ms. Compromis entre réactivité et performance. Le coût est surtout sensible sur la borne.

**Q14. À quoi sert `RAYON_ABANDON` supérieur à `RAYON_DETECTION` ?**
Hystérésis : deux seuils différents pour entrer et sortir de l'état alerte, afin que l'état ne clignote pas quand le joueur est à la limite.

**Q15. Comment fonctionne le tirage d'un type d'ennemi ?**
Tirage pondéré : somme des poids, nombre aléatoire dans cette somme, soustraction progressive. Les poids dépendent du niveau (fonction `poids(niveau)`), ce qui fait apparaître les types progressivement.

**Q16. Pourquoi deux caméras ?**
Le zoom adaptatif grossit tout ce que filme la caméra principale, HUD compris. Une seconde caméra sans zoom ne filme que le HUD (objets avec `scrollFactor` 0). Chaque objet est ignoré par l'une des deux caméras (`camera.ignore`).

**Q17. Qu'est-ce qu'un tween ? Donne un usage.**
Une animation automatique d'une propriété d'un objet entre deux valeurs sur une durée, avec une courbe d'accélération (`ease`). Exemples : le tremblement d'un caillou touché, le rebond du butin, le clignotement du joueur blessé.

**Q18. Comment le décor est-il dessiné de façon performante ?**
`figerDecor` : on dessine les calques de tuiles une fois dans une `RenderTexture` (une seule image) et on cache les calques, qui restent utilisés pour les collisions. Voir 3.5.

### Niveau difficile

**Q19. Explique l'éclairage de A à Z, et pourquoi pas Light2D.**
Section 4. Light2D de Phaser : un shader qui boucle sur `maxLights` par pixel, trop lourd pour le GPU du Pi (environ 10 FPS mesurés). Notre solution : un noir sur tout l'écran dans lequel on gomme des pinceaux en dégradé, en un seul appel. Aucun calcul par pixel. Ajouts : noir à demi-résolution, teintes en `MULTIPLY`, réutilisation des objets pinceaux.

**Q20. Pourquoi réutiliser les images-pinceaux plutôt que d'en créer à chaque image ?**
Créer et détruire des objets 60 fois par seconde produit des déchets que le ramasse-miettes doit nettoyer, avec des saccades. On les garde dans un tableau et on remet juste un compteur à 0.

**Q21. Comment la torche sait-elle où s'arrêter ?**
`distanceMur` avance de 8 px dans la direction du regard jusqu'à rencontrer une tuile du calque des murs (`hasTileAtWorldXY`) ou atteindre la portée. Les trois pinceaux de la torche sont répartis le long de cette distance. C'est un lancer de rayon discret sur la grille.

**Q22. Comment gère-t-on la couleur d'une lumière alors que la gomme n'en a pas ?**
En parallèle de chaque pinceau, on pose une image colorée (même dégradé, teinte `setTint`) en mode `MULTIPLY`, juste sous la couche de noir. Le mélange multiplicatif assombrit/teinte l'image dessous sans la délaver.

**Q23. Votre BFS donne-t-il toujours le chemin le plus court ?**
En nombre de cases, oui. En distance réelle, pas forcément, car une diagonale coûte autant qu'un pas droit. Pour être exact, il faudrait Dijkstra ou A* avec un coût de 1,41 en diagonale. Ici l'écart est invisible en jeu.

**Q24. Quelle est la complexité du BFS ?**
O(V + E) avec V le nombre de cases (50 x 34 = 1700) et E environ 8 V. Mais `file.shift()` sur un tableau JS est en O(n), ce qui dégrade en pratique. Sur 1700 cases c'est négligeable.

**Q25. `casesBloquees` est appelée à chaque image : ça pose un problème ?**
Oui, c'est une faiblesse que je connais : elle reconstruit un `Set` de toutes les cases-mur (environ 1700 cases à parcourir) à chaque image dans `majEnnemis`. Une optimisation simple serait de calculer les murs une fois par niveau et de ne mettre à jour que les cailloux et cristaux. Je ne l'ai pas fait faute de temps, et le jeu tient les 50 FPS.

**Q26. Comment éviter qu'un ennemi blesse le joueur à chaque image au contact ?**
`overlap` est déclenché à chaque image. `degatsJoueur` impose une invulnérabilité de 1 s après un coup (`invulnerable_jusqua`). L'ennemi recule aussi un instant (`recul_jusqua`).

**Q27. Comment garantissez-vous que le trou est atteignable ?**
Il est caché sous un caillou, et les cailloux sont posés sur des cases de sol (`calque_sol.filterTiles` sans mur). Comme la grille ne contient qu'une seule zone de sol connexe (étape 3 de la génération), toute case de sol est atteignable depuis n'importe quelle autre. Vérifie tout de même : un caillou peut en théorie bloquer un passage étroit (voir section 8).

**Q28. Comment fonctionne la caméra qui s'adapte aux deux joueurs ?**
Section 6.3. Cible = milieu des joueurs ; zoom voulu = rapport entre la taille de l'écran et la boîte englobante des joueurs plus une marge, borné entre 0,7 et 1,5 ; interpolation linéaire à 8 % par image pour la douceur ; `limiterAEcran` empêche de sortir de l'écran.

**Q29. Pourquoi les modules reçoivent `scene` en paramètre au lieu d'être des classes ?**
Choix de simplicité : `niveau1.js` était déjà long, on a extrait des blocs cohérents (ennemis, lumière, butin) en fonctions qui lisent et écrivent sur la scène (`scene.ennemis`, `scene.cristaux`). Inconvénient : couplage fort et dépendances implicites sur les propriétés de la scène. Une version propre utiliserait des classes avec leur propre état.

**Q30. Qu'est-ce que vous feriez différemment ?**
Réponse prête, honnête : factoriser le code des modes de lumière inutilisés, calculer les cases bloquées une fois par niveau, passer à A* si les niveaux grandissent, ajouter des tests sur la génération (vérifier la connexité sur 1000 grilles), supprimer les scènes `niveau2`/`niveau3` héritées du gabarit.

### Questions sur l'usage de l'IA
Le jury sait que vous avez utilisé l'IA. Ne le nie pas, présente-le comme un outil dont tu maîtrises le résultat :
- "J'ai utilisé l'IA comme assistant, mais je peux expliquer chaque choix." Et le prouver en nommant fonction et ligne.
- Sois précis sur ce que tu as conçu (l'idée, les règles de jeu, les valeurs d'équilibrage) et sur ce que l'IA a aidé à écrire (implémentation, optimisation). Ne revendique pas ce qui est faux : le jury creusera.
- Pour une valeur magique du code, sois capable de dire d'où elle vient (mesure, essai, calcul) ou d'admettre que c'est un réglage empirique.

---

## 8. Points faibles du code (à connaître avant le jury)

Ce sont des choses vues en lisant, pas des jugements définitifs. Tu peux les mentionner toi-même pour montrer du recul.

1. **`niveau2.js` et `niveau3.js`** : restes du gabarit fourni (plateformes, `img_perso`, `img_ciel`), déclarés dans `index.js` mais jamais utilisés par le jeu. À supprimer ou expliquer.
2. **`fonctions.js`** commence par `doNothing` et `doAlsoNothing`, exemples du gabarit.
3. **`index.html`** : `<title>Mon premier jeu en Phaser 3</title>`. À renommer en "Artemis".
4. **`readme.md`** : contient "Peut être qu'il faudrait update le readme ?". Un jury peut le lire. Remplace-le par un vrai README court (description, commandes, auteurs).
5. **`game.json`** : le champ `authors` est un tableau avec une seule chaîne contenant les trois noms, et la description se termine par "pierre lunaire pour ?". À corriger.
6. **Code mort de lumière** : les modes `light2d`, `ancien`, `aucune` et les constantes `ECLAIRER_*`. Utiles pour comparer, mais à expliquer comme tels.
7. **Marqueurs `/* >>>>> AJOUT SON <<<<< */`** partout dans le code : commentaires de coordination avec la personne qui a ajouté le son. Fonctionnels, mais bruyants.
8. **Instruments de debug laissés dans le code** : `AFFICHER_FPS`, `BENCH_AUTO`, `DIAG`. Tous à `false`/inactifs par défaut, donc sans effet en jeu.
9. **Performance** : `casesBloquees` recalculée à chaque image (voir Q25), `file.shift()` dans les BFS.
10. **Cas limite possible** : un caillou peut en théorie boucher un couloir d'une case de large. On le résout en le cassant (3 coups), mais le trou ne peut pas être bloqué définitivement car les cailloux sont cassables. À vérifier si on te pose la question.
11. **Tests automatiques** : il n'y en a pas. Si on te demande comment vous avez vérifié, réponds : tests manuels, compteur de FPS sur la borne, banc d'essai pour la lumière.

Ces points sont peut-être déjà corrigés ou à corriger avant le rendu de vendredi 12h30. Vérifie avec tes coéquipiers.

---

## 9. Chiffres et constantes à connaître par coeur

| Élément | Valeur | Où |
|---|---|---|
| Écran | 1280 x 720 | `index.js` |
| Taille d'un niveau | 50 x 34 cases de 32 px | `niveau1.js` |
| Mur au départ | 45 % ; 5 lissages ; bordure 3 | `generation.js` |
| Zone de sol minimale | 35 % ; 20 essais | `generation.js` |
| Biome | change tous les 5 niveaux ; salle sûre au niveau 5, 10, 15 | `biomes.js` |
| Vitesse joueur | 160 px/s ; sprint 260 | `niveau1.js` |
| PV et stamina | 100 chacun ; sprint coûte 35/s, recharge 20/s | `niveau1.js` |
| Caillou | 3 coups ; cristal 5 | `niveau1.js`, `cristaux.js` |
| Pierres lâchées | 30 % de chance, 1 à 3 ; cristal : 2 à 4 à coup sûr | `pierres.js`, `cristaux.js` |
| Potion | 12 % de chance | `bonus.js` |
| Ennemis | 4 au niveau 1, +1 tous les 3 niveaux, max 7 | `ennemis.js` |
| Détection | 300 px ; abandon 450 px ; chemin recalculé toutes les 400 ms | `ennemis.js` |
| Rayon du cristal | charge 1 s, tir 0,5 s, pause 4 s ; 40 dégâts | `ennemis.js` |
| Invulnérabilité après coup | 1 s | `ennemis.js` |
| Zoom caméra | 0,7 à 1,5 ; 8 % de rattrapage par image | `niveau1.js` |
| Offrande | 5 pierres = 25 PV, prix +5 tous les 5 niveaux | `niveau1.js` |
| Lumière | noir à 0,5 de résolution ; 3 pinceaux de torche ; portée 260 px | `lumiere.js` |

---

## 10. Dernières vérifications avant vendredi

- Relance le jeu en entier une fois (menu, tutoriel, niveaux 1 à 6, salle sûre au niveau 5, mode duo) pour t'assurer que ce que tu présentes marche.
- Prépare une démonstration courte (la vidéo `demo.mp4` du dépôt peut servir de secours si la démo en direct échoue).
- Répartis-vous les fonctionnalités avec Inas et Liku pour les 10 min, et décidez qui répond à quoi. Le jury note chacun individuellement : tu ne peux pas laisser un camarade répondre à ta place.
- Relis le code que tu présentes à voix haute, ligne par ligne, une fois. Si tu butes sur une ligne, c'est celle-là qu'il faut retravailler.
- Pour s'entraîner : demande-moi de t'interroger sur une section, une question à la fois, en jouant le jury.
