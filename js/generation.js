/***********************************************************************/
/** GENERATION PROCEDURALE DES NIVEAUX (type "grotte")
/***********************************************************************/

/* Principe (automate cellulaire) :
 * 1. on remplit une grille au hasard : chaque case est un mur ou du sol
 * 2. on "lisse" plusieurs fois : une case devient mur si la plupart de ses voisines sont des murs
 *    -> le bruit se transforme en grottes aux formes arrondies
 * 3. on ne garde que la plus grande zone de sol d'un seul tenant : tout le niveau est accessible
 * La grille renvoyée est un tableau de lignes : grille[y][x] = true si mur, false si sol.
 */

const PROBA_MUR = 0.45; // probabilité qu'une case soit un mur au départ
const NB_LISSAGES = 5;
const BORDURE = 3; // cases de mur autour du niveau (3 = hauteur d'un mur nord complet)
const PART_SOL_MIN = 0.35; // on recommence si la zone jouable est trop petite
const NB_ESSAIS_MAX = 20;

// numéros des tuiles dans walls_floor.png (ligne x 13 + colonne), relevés dans map_test
export const TUILES = {
    sol: 79,
    plein: 14, // intérieur de la roche (noir)
    mur_nord_bord: 7, // haut d'un mur nord (3e case au-dessus du sol)
    mur_nord_haut: 20, // briques, 2e case au-dessus du sol
    mur_nord_bas: 33, // briques, juste au-dessus du sol
    mur_sud: 43, // rebord juste sous le sol
    mur_ouest: 16, // mur à gauche du sol
    mur_est: 13, // mur à droite du sol
    coin_sud_ouest: 42,
    coin_sud_est: 44
};

// génère une grille jouable de largeur x hauteur cases
export function genererGrille(largeur, hauteur) {
    let meilleure = null;
    for (let essai = 0; essai < NB_ESSAIS_MAX; essai++) {
        let grille = remplirAuHasard(largeur, hauteur);
        for (let i = 0; i < NB_LISSAGES; i++) grille = lisser(grille);

        const zone = plusGrandeZone(grille);
        // on ne garde que la plus grande zone : tout le reste devient mur
        const resultat = creerGrille(largeur, hauteur, () => true);
        zone.forEach(([x, y]) => (resultat[y][x] = false));

        if (zone.length >= largeur * hauteur * PART_SOL_MIN) return resultat;
        if (!meilleure || zone.length > meilleure.taille) meilleure = { grille: resultat, taille: zone.length };
    }
    return meilleure.grille; // aucun essai assez grand : on prend le moins mauvais
}

// choisit la tuile d'un mur selon l'endroit où se trouve le sol autour de lui
export function tuileMur(grille, x, y) {
    const sol = (dx, dy) => estSol(grille, x + dx, y + dy);
    // un mur nord fait 3 cases de haut : bas des briques, haut des briques, rebord
    if (sol(0, 1)) return TUILES.mur_nord_bas;
    if (sol(0, 2)) return TUILES.mur_nord_haut;
    if (sol(0, 3)) return TUILES.mur_nord_bord;
    if (sol(0, -1)) return TUILES.mur_sud;
    if (sol(1, 0)) return TUILES.mur_ouest;
    if (sol(-1, 0)) return TUILES.mur_est;
    if (sol(1, -1)) return TUILES.coin_sud_ouest;
    if (sol(-1, -1)) return TUILES.coin_sud_est;
    return TUILES.plein;
}

function creerGrille(largeur, hauteur, valeur) {
    return Array.from({ length: hauteur }, (_, y) => Array.from({ length: largeur }, (_, x) => valeur(x, y)));
}

function estBordure(grille, x, y) {
    return x < BORDURE || y < BORDURE || x >= grille[0].length - BORDURE || y >= grille.length - BORDURE;
}

// hors de la grille, on considère qu'il y a du mur
function estSol(grille, x, y) {
    return y >= 0 && y < grille.length && x >= 0 && x < grille[0].length && !grille[y][x];
}

function remplirAuHasard(largeur, hauteur) {
    return creerGrille(largeur, hauteur, (x, y) => Math.random() < PROBA_MUR);
}

// une case devient mur si 5 voisines ou plus sont des murs (4 : elle ne change pas)
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

// parcours en largeur de chaque zone de sol (voisins haut/bas/gauche/droite) : renvoie les cases de la plus grande
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
                const nx = cx + dx;
                const ny = cy + dy;
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
