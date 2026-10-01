export function doNothing() {
    // cette fonction ne fait rien.
    // c'est juste un exemple pour voir comment mettre une fonction
    // dans un fichier et l'utiliser dans les autres
}


export function doAlsoNothing() {
    // cette fonction ne fait rien non plus.
 }


/***********************************************************************/
/** COMMANDES (cf. docs/documentation.html, section Commandes)
/***********************************************************************/

// touches de la borne d'arcade : le joystick + 6 boutons par joueur, sur deux rangées de trois
// les deux joueurs ont les mêmes actions, dans le même ordre :
//   rangée du haut : interagir en face, interagir avec un objet, lampe
//   rangée du bas  : frapper / tirer, sprint, changer d'équipement
// les deux interactions (1er et 2e boutons du haut) seront ajoutées avec leurs mécaniques

// joueur 1 : joystick = les flèches ; boutons I O P (haut) et K L M (bas)
export const TOUCHES_J1 = {
    haut: "UP",
    bas: "DOWN",
    gauche: "LEFT",
    droite: "RIGHT",
    torche: "P",
    frapper_tirer: "K",
    sprint: "L",
    changer_equipement: "M",
    interagir: "I", // interagir en face (échelle)
    objet: "O" // interagir avec un objet (offrande à la statue)
};

// joueur 2 : joystick = ZQSD ; boutons R T Y (haut) et F G H (bas)
export const TOUCHES_J2 = {
    haut: "Z",
    bas: "S",
    gauche: "Q",
    droite: "D",
    torche: "Y",
    frapper_tirer: "F",
    sprint: "G",
    changer_equipement: "H",
    interagir: "R",
    objet: "T"
};

// crée les objets Phaser.Key à partir d'une table de touches : { haut: Key, bas: Key, ... }
export function creerTouches(scene, touches) {
    return scene.input.keyboard.addKeys(touches);
}


/***********************************************************************/
/** JOUEURS (le joueur 2 n'existe qu'en mode duo)
/***********************************************************************/

// cle : sert à nommer les sprites et les animations du joueur (cf. cleSprite et cleAnim)
// dossier, prefixe : où sont ses images (assets/character/<dossier>/<prefixe>walk_down.png ...)
// laser : couleur de ses tirs ("bleu" ou "rouge", cf. assets/character/fire/)
export const JOUEURS = [
    { numero: 1, cle: "joueur", dossier: "mc", prefixe: "", laser: "bleu", touches: TOUCHES_J1 },
    { numero: 2, cle: "joueur2", dossier: "mc2", prefixe: "mc2_", laser: "rouge", icones: { laser: "gun2" }, touches: TOUCHES_J2 }
];

// clés Phaser des sprites et des animations d'un joueur : cleSprite(JOUEURS[0], "walk_down") = "sprite_joueur_walk_down"
export const cleSprite = (joueur, nom) => "sprite_" + joueur.cle + "_" + nom;
export const cleAnim = (joueur, nom) => "anim_" + joueur.cle + "_" + nom;


/***********************************************************************/
/** PROFONDEURS D'AFFICHAGE
/***********************************************************************/

// le joueur et les cailloux utilisent leur y comme profondeur (tri vue de dessus) : de 0 à la hauteur du niveau en px
// tout ce qui doit passer devant eux a donc une profondeur bien plus grande que n'importe quel y
export const PROFONDEUR = {
    projectiles: 5000,
    obscurite: 10000,
    hud: 10001
};


/***********************************************************************/
/** TYPOGRAPHIES (déclarées dans index.html, fichiers dans assets/fonts/)
/***********************************************************************/

// logo : titre du jeu ; bouton : touches à presser et compteurs ; texte : tout le reste
// la police de secours (sans-serif) s'affiche si un fichier est absent
export const POLICES = {
    logo: '"Origin Tech", sans-serif',
    bouton: '"Ethnocentric", sans-serif',
    texte: '"Kallisto", sans-serif'
};

// charge les trois polices avant d'afficher quoi que ce soit (sinon le premier texte apparait avec la police de secours)
export function chargerPolices() {
    return Promise.all(Object.values(POLICES).map((police) => document.fonts.load("20px " + police))).catch(() => {});
}


// texte qui monte en s'effaçant à (x, y) du monde (gain de PV, bonus ramassé, refus...)
export function texteFlottant(scene, x, y, message, couleur) {
    const texte = scene.add.text(x, y, message, { fontFamily: POLICES.texte, fontSize: "20px", color: couleur, stroke: "#20283A", strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(PROFONDEUR.projectiles);
    scene.tweens.add({ targets: texte, y: y - 30, alpha: 0, duration: 1000, ease: "Quad.easeOut", onComplete: () => texte.destroy() });
}


/***********************************************************************/
/** HUD : BARRES DE VIE / STAMINA
/***********************************************************************/

const NB_FRAMES_BARRE = 11; // frame 0 = vide, frame 10 = pleine (10 segments)
const ECHELLE_BARRE = 2; // 96x16 -> 192x32 à l'écran (entier : le pixel art reste net)

// crée une barre fixée à l'écran (elle ne suit pas la caméra)
export function creerBarre(scene, x, y, cle) {
    return scene.add.sprite(x, y, cle, NB_FRAMES_BARRE - 1)
        .setOrigin(0, 0)
        .setScale(ECHELLE_BARRE)
        .setScrollFactor(0)
        .setDepth(PROFONDEUR.hud);
}

// affiche la frame correspondant à valeur / max
export function majBarre(barre, valeur, max) {
    // arrondi au segment supérieur : la barre ne paraît vide qu'à 0 exactement
    const segments = Math.ceil((valeur / max) * (NB_FRAMES_BARRE - 1));
    barre.setFrame(segments);
}


/***********************************************************************/
/** HUD : BULLES D'EQUIPEMENT (comme l'objet de Mario Kart)
/***********************************************************************/

const RAYON_BULLE = 36; // px : bulle de l'équipement actuel
const ECHELLE_PETITE_BULLE = 2 / 3; // la petite bulle est une copie réduite de la grande
const DECALAGE_PETITE_BULLE = { x: 40, y: 30 }; // px : position de la petite par rapport à la grande
const OPACITE_PETITE_BULLE = 0.85;
const DUREE_ECHANGE_BULLES = 180; // ms

const TAILLE_ICONE = 64; // px : carré dans lequel une icône en image doit tenir (dans la bulle de 72 px) : 32x32 -> x2

// icône d'un équipement : si l'image "img_icone_<nom>" est chargée (cf. selection.js, dossier assets/ui/), on l'utilise ;
// sinon on dessine le placeholder ci-dessous, centré sur (0, 0), dans un carré d'environ 44 px
const DESSIN_ICONES = {
    pioche: (g) => {
        // manche en bois, du bas gauche vers le haut droit (contour sombre puis bois)
        g.lineStyle(7, 0x3a4050);
        g.lineBetween(-16, 16, 13, -13);
        g.lineStyle(4, 0x9a6b43);
        g.lineBetween(-16, 16, 13, -13);
        // tête en métal : un arc en travers du bout du manche
        const tete = new Phaser.Curves.QuadraticBezier(
            new Phaser.Math.Vector2(-7, -20),
            new Phaser.Math.Vector2(19, -19),
            new Phaser.Math.Vector2(20, 7)
        ).getPoints(20);
        g.lineStyle(8, 0x3a4050);
        g.strokePoints(tete);
        g.lineStyle(5, 0xbfc3cc);
        g.strokePoints(tete);
    },

};

// une bulle = un cercle sombre + une icône + un contour rose par-dessus, fixée à l'écran
// le contour est dessiné en dernier : il cache le bord de l'icône si elle touche l'anneau
function creerBulle(scene) {
    const fond = scene.add.graphics().setScrollFactor(0);
    fond.fillStyle(0x111a32, 0.9);
    fond.fillCircle(0, 0, RAYON_BULLE);
    const anneau = scene.add.graphics().setScrollFactor(0);
    anneau.lineStyle(3, 0xec8697);
    anneau.strokeCircle(0, 0, RAYON_BULLE);
    const dessin = scene.add.graphics().setScrollFactor(0); // placeholder dessiné en code
    const image = scene.add.image(0, 0, "__DEFAULT").setScrollFactor(0).setVisible(false); // vrai sprite
    const bulle = scene.add.container(0, 0, [fond, dessin, image, anneau]).setScrollFactor(0);
    bulle.dessin = dessin;
    bulle.image = image;
    return bulle;
}

// icones : { équipement: nom de l'icône } pour les joueurs dont l'icône d'un équipement diffère (ex. l'arme du joueur 2)
function dessinerIcone(bulle, nom, icones = {}) {
    const cle = "img_icone_" + (icones[nom] ?? nom);
    bulle.dessin.clear();
    if (bulle.scene.textures.exists(cle)) {
        // agrandissement entier (x1, x2, x3...) pour que le pixel art reste net
        const source = bulle.scene.textures.get(cle).getSourceImage();
        const echelle = Math.max(1, Math.floor(TAILLE_ICONE / Math.max(source.width, source.height)));
        bulle.image.setTexture(cle).setScale(echelle).setVisible(true);
    } else {
        bulle.image.setVisible(false);
        DESSIN_ICONES[nom](bulle.dessin);
    }
}

// crée les deux bulles : l'équipement actuel en grand, le suivant en petit, en dessous et derrière
// x, y : centre de la grande bulle ; equipements : liste des noms (dans l'ordre du changement)
// sens : 1 = la petite bulle est en bas à droite de la grande, -1 = en bas à gauche (HUD du joueur 2, en miroir)
// renvoie { afficher(nom), changer(nom) } : changer() joue l'animation d'échange
// icones : cf. dessinerIcone
export function creerBullesEquipement(scene, x, y, equipements, actuel, sens = 1, icones = {}) {
    const GRANDE = { x: x, y: y, echelle: 1, opacite: 1, profondeur: PROFONDEUR.hud + 1 };
    const PETITE = {
        x: x + sens * DECALAGE_PETITE_BULLE.x,
        y: y + DECALAGE_PETITE_BULLE.y,
        echelle: ECHELLE_PETITE_BULLE,
        opacite: OPACITE_PETITE_BULLE,
        profondeur: PROFONDEUR.hud
    };
    let grande = creerBulle(scene);
    let petite = creerBulle(scene);
    let terminer_echange = null; // renseigné pendant une animation pour pouvoir la finir d'un coup

    const placer = (bulle, cible) =>
        bulle.setPosition(cible.x, cible.y).setScale(cible.echelle).setAlpha(cible.opacite).setDepth(cible.profondeur);
    const suivant = (nom) => equipements[(equipements.indexOf(nom) + 1) % equipements.length];

    // affichage direct, sans animation
    const afficher = (nom) => {
        if (terminer_echange) terminer_echange();
        placer(grande, GRANDE);
        placer(petite, PETITE);
        dessinerIcone(grande, nom, icones);
        dessinerIcone(petite, suivant(nom), icones);
    };

    // la petite bulle (le nouvel équipement) grandit et prend la place de la grande, qui rapetisse
    const changer = (nom) => {
        if (terminer_echange) terminer_echange(); // un appui rapide sur H ne doit pas empiler les animations
        const partante = grande;
        const arrivante = petite;
        arrivante.setDepth(GRANDE.profondeur);
        partante.setDepth(PETITE.profondeur);

        let termine = false;
        terminer_echange = () => {
            if (termine) return; // appelée par les deux animations : on ne l'exécute qu'une fois
            termine = true;
            scene.tweens.killTweensOf([partante, arrivante]);
            placer(arrivante, GRANDE);
            placer(partante, PETITE);
            grande = arrivante;
            petite = partante;
            dessinerIcone(petite, suivant(nom), icones);
            terminer_echange = null;
        };

        const animer = (bulle, cible) => scene.tweens.add({
            targets: bulle,
            x: cible.x,
            y: cible.y,
            scale: cible.echelle,
            alpha: cible.opacite,
            duration: DUREE_ECHANGE_BULLES,
            ease: "Sine.easeInOut",
            onComplete: () => terminer_echange && terminer_echange()
        });
        animer(arrivante, GRANDE);
        animer(partante, PETITE);
    };

    afficher(actuel);
    return { afficher, changer };
}
