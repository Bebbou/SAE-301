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

// touches clavier du joueur 1 (le joystick = les flèches)
// R (interagir en face) et T (interagir avec un objet) seront ajoutées avec leurs mécaniques
export const TOUCHES_J1 = {
    haut: "UP",
    bas: "DOWN",
    gauche: "LEFT",
    droite: "RIGHT",
    frapper_tirer: "F",
    sprint: "G",
    torche: "Y",
    changer_equipement: "H"
};

// crée les objets Phaser.Key à partir d'une table de touches : { haut: Key, bas: Key, ... }
export function creerTouches(scene, touches) {
    return scene.input.keyboard.addKeys(touches);
}


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
