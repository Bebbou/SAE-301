export function doNothing() {
    // cette fonction ne fait rien.
    // c'est juste un exemple pour voir comment mettre une fonction
    // dans un fichier et l'utiliser dans les autres
}


export function doAlsoNothing() {
    // cette fonction ne fait rien non plus.
 }


/***********************************************************************/
/** HUD : BARRES DE VIE / STAMINA
/***********************************************************************/

const NB_FRAMES_BARRE = 10; // les spritesheets de barre ont 10 niveaux de remplissage (1 à 10 segments)
const ECHELLE_BARRE = 3; // 96x16 -> 288x48 à l'écran

// crée une barre fixée à l'écran (elle ne suit pas la caméra)
export function creerBarre(scene, x, y, cle) {
    return scene.add.sprite(x, y, cle, NB_FRAMES_BARRE - 1)
        .setOrigin(0, 0)
        .setScale(ECHELLE_BARRE)
        .setScrollFactor(0)
        .setDepth(100);
}

// affiche la frame correspondant à valeur / max
export function majBarre(barre, valeur, max) {
    const segments = Math.ceil((valeur / max) * NB_FRAMES_BARRE);
    // pas de frame "vide" dans la spritesheet : à 0 on garde 1 segment, mais en transparence
    barre.setFrame(Math.max(segments - 1, 0));
    barre.setAlpha(valeur > 0 ? 1 : 0.4);
}
