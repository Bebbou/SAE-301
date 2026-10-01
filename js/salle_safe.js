/***********************************************************************/
/** SALLE SAFE : une salle de temple (map faite sous Tiled) qui apparait rarement entre deux niveaux
/** toujours éclairée, sans ennemi ni caillou ; on y entre par l'échelle de montée et on en repart par le trou
/***********************************************************************/

export const CLE_MAP = "map_safe";
export const FICHIER_MAP = "./assets/map/safe_map_test.tmj";

// tilesets de la map : [nom dans Tiled, clé Phaser de l'image, fichier]
// "walls_floor" est déjà chargé par selection.js pour les niveaux générés (fichier null)
export const TILESETS = [
  ["walls_floor", "tiles_walls_floor", null],
  ["Walls_floor", "tiles_safe_walls_and_floor", "./assets/map/walls_and_floor.png"],
  ["Exterior_objects", "tiles_safe_exterior_objects", "./assets/map/exterior_objects.png"],
  ["chest", "tiles_safe_chest", "./assets/map/chest.png"],
  ["tileset_artemis_statue", "tiles_safe_statue", "./assets/map/tileset_artemis_statue.png"],
  ["Objects_interior", "tiles_safe_objects_interior", "./assets/map/objects_interior.png"]
];

// chance qu'un nouveau niveau soit la salle safe ; en ouvrant le jeu avec "?safe" dans l'adresse elle apparait à chaque fois (pour la tester)
const CHANCE_SAFE = 0.1;
export const chanceSafe = () => (new URLSearchParams(window.location.search).has("safe") ? 1 : CHANCE_SAFE);

// positions des deux passages, en pixels (cases de 32 px) : l'échelle pour remonter à gauche, le trou pour descendre à droite
export const MONTEE = { x: 12 * 32 + 16, y: 12 * 32 + 16 };
export const TROU = { x: 30 * 32 + 16, y: 12 * 32 + 16 };

// la statue (cf. offrande.js) : rectangle solide [x, y, largeur, hauteur] ; sa tête dépasse en haut, vers y = 165
export const STATUE = { rect: [650, 224, 76, 94], centre_x: 688, tete_y: 165 };

// objets de décor solides, en pixels de la map : [x, y, largeur, hauteur]
// (les tuiles du calque "assets" ne sont pas solides : on pose ici des rectangles invisibles sous la statue, le coffre, etc.)
// la statue descend jusqu'au mur : on ne peut pas passer derrière
const OBSTACLES = [
  STATUE.rect, // statue
  [662, 376, 48, 32], // coffre
  [497, 192, 34, 24], // vase gauche
  [849, 192, 34, 24], // vase droit
  [1006, 196, 24, 36], // colonne en haut à droite
  [349, 520, 26, 32], // colonne en bas à gauche
  [320, 198, 70, 34], // gravats en haut à gauche
  [1000, 508, 64, 52] // gravats en bas à droite
];

// construit la map Tiled : renvoie { map, calque_sol, calque_murs } comme pour un niveau généré
export function creerCarte(scene) {
  const map = scene.make.tilemap({ key: CLE_MAP });
  const tilesets = TILESETS.map(([nom, cle]) => map.addTilesetImage(nom, cle));
  const calques = {};
  ["background", "sol", "murs", "assets"].forEach((nom) => { calques[nom] = map.createLayer(nom, tilesets); });
  calques.murs.setCollisionByExclusion([-1]); // toutes les tuiles du calque "murs" sont solides
  return { map: map, calque_sol: calques.sol, calque_murs: calques.murs };
}

// rectangles invisibles des objets solides (un groupe statique : joueurs et lasers s'y arrêtent)
export function creerObstacles(scene) {
  const groupe = scene.physics.add.staticGroup();
  OBSTACLES.forEach(([x, y, largeur, hauteur]) => {
    const zone = scene.add.zone(x + largeur / 2, y + hauteur / 2, largeur, hauteur);
    groupe.add(zone); // le corps statique prend la taille de la zone
  });
  return groupe;
}
