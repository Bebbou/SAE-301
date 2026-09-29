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


/***********************************************************************/
/** HUD : BULLES D'EQUIPEMENT (comme l'objet de Mario Kart)
/***********************************************************************/

const RAYON_BULLE = 36; // px : bulle de l'équipement actuel
const ECHELLE_PETITE_BULLE = 2 / 3; // la petite bulle est une copie réduite de la grande
const DECALAGE_PETITE_BULLE = { x: 40, y: 30 }; // px : position de la petite par rapport à la grande
const OPACITE_PETITE_BULLE = 0.85;
const DUREE_ECHANGE_BULLES = 180; // ms

// dessin de chaque icône, centré sur (0, 0), dans un carré d'environ 44 px
// (placeholders dessinés en code : à remplacer par de vrais sprites)
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
    laser: (g) => {
        g.fillStyle(0x3a4050); // crosse
        g.fillRect(-17, 2, 10, 13);
        g.fillStyle(0x777c87); // corps
        g.fillRect(-22, -12, 32, 14);
        g.fillStyle(0xbfc3cc); // reflet
        g.fillRect(-22, -12, 32, 4);
        g.fillStyle(0x3a4050); // canon
        g.fillRect(10, -9, 9, 8);
        g.fillStyle(0x4fc3f7); // bande d'énergie
        g.fillRect(-14, -4, 14, 3);
        g.fillStyle(0x9dd9ff); // bout du canon
        g.fillRect(19, -8, 3, 6);
    }
};

// une bulle = un cercle sombre à contour rose + une icône, fixée à l'écran
function creerBulle(scene) {
    const fond = scene.add.graphics().setScrollFactor(0);
    fond.fillStyle(0x111a32, 0.9);
    fond.fillCircle(0, 0, RAYON_BULLE);
    fond.lineStyle(3, 0xec8697);
    fond.strokeCircle(0, 0, RAYON_BULLE);
    const icone = scene.add.graphics().setScrollFactor(0);
    const bulle = scene.add.container(0, 0, [fond, icone]).setScrollFactor(0);
    bulle.icone = icone;
    return bulle;
}

function dessinerIcone(bulle, nom) {
    bulle.icone.clear();
    DESSIN_ICONES[nom](bulle.icone);
}

// crée les deux bulles : l'équipement actuel en grand, le suivant en petit, en dessous et derrière
// x, y : centre de la grande bulle ; equipements : liste des noms (dans l'ordre du changement)
// renvoie { afficher(nom), changer(nom) } : changer() joue l'animation d'échange
export function creerBullesEquipement(scene, x, y, equipements, actuel) {
    const GRANDE = { x: x, y: y, echelle: 1, opacite: 1, profondeur: PROFONDEUR.hud + 1 };
    const PETITE = {
        x: x + DECALAGE_PETITE_BULLE.x,
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
        dessinerIcone(grande, nom);
        dessinerIcone(petite, suivant(nom));
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
            dessinerIcone(petite, suivant(nom));
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
