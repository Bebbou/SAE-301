import * as fct from "./fonctions.js";
import * as salle_safe from "./salle_safe.js";

/***********************************************************************/
/** VARIABLES GLOBALES
/***********************************************************************/

// directions du joueur : une spritesheet de marche par direction
// la gauche n'a pas d'image : on retourne la droite (flipX) dans la scene
const DIRECTIONS = ["down", "up", "right", "down_diagonal", "up_diagonal"];
// chaque direction existe en deux variantes : mains vides (pioche) et avec le fusil ("_gun")
const VARIANTES_JOUEUR = ["", "_gun"];
// coup de pioche : 3 directions seulement (les diagonales et la gauche réutilisent ces sprites, cf. niveau1.js)
const DIRECTIONS_PIOCHE = ["down", "up", "right"];

// définition de la classe "selection"
export default class selection extends Phaser.Scene {
  constructor() {
    super({ key: "selection" }); // mettre le meme nom que le nom de la classe
  }

  /***********************************************************************/
  /** FONCTION PRELOAD
/***********************************************************************/

  /** La fonction preload est appelée une et une seule fois,
   * lors du chargement de la scene dans le jeu.
   * On y trouve surtout le chargement des assets (images, son ..)
   */
  preload() {
    const baseURL = this.sys.game.config.baseURL;

    this.load.setBaseURL(baseURL);

    // map de test (export JSON de Tiled) et ses tilesets
    // le nom du tileset doit etre le meme que dans Tiled
    this.load.tilemapTiledJSON("map_test", "./assets/map/map_test.tmj");
    this.load.image("tiles_decorative_cracks_floor", "./assets/map/decorative_cracks_floor.png");
    this.load.image("tiles_decorative_cracks_walls", "./assets/map/decorative_cracks_walls.png");
    this.load.image("tiles_walls_floor", "./assets/map/walls_floor.png");

    // salle safe (map Tiled) et ses tilesets (cf. salle_safe.js)
    this.load.tilemapTiledJSON(salle_safe.CLE_MAP, salle_safe.FICHIER_MAP);
    salle_safe.TILESETS.forEach(([nom, cle, fichier]) => { if (fichier) this.load.image(cle, fichier); });

    // HUD : 11 frames de 96x16 (frame 0 = vide, frame 10 = pleine)
    this.load.spritesheet("sprite_barre_vie", "./assets/ui/life.png", { frameWidth: 96, frameHeight: 16 });
    this.load.spritesheet("sprite_barre_stamina", "./assets/ui/stamina.png", { frameWidth: 96, frameHeight: 16 });

    // icônes des équipements (bulles du HUD) : nom = "icone_" + nom de l'équipement, clé = "img_icone_" + nom
    // tant qu'un fichier est absent, le HUD affiche un dessin de remplacement (cf. fonctions.js)
    this.load.image("img_icone_pioche", "./assets/ui/icone_pioche.png");
    this.load.image("img_icone_laser", "./assets/ui/icone_laser.png");
    this.load.image("img_icone_gun2", "./assets/ui/icone_gun2.png"); // arme du joueur 2

    // pierre lunaire (16x16) : icône du compteur et drops (cf. pierres.js)
    this.load.image("img_pierre_lunaire", "./assets/ui/pierre_lunaire.png");

    // cristaux décoratifs des niveaux (cf. cristaux.js) : 24 images de 38x39
    this.load.spritesheet("sprite_cristal", "./assets/map/yellow_crystal.png", { frameWidth: 38, frameHeight: 39 });

    // potions lâchées par les cailloux (cf. bonus.js) : frames de 16x16, animées
    ["heal", "vision", "vitesse"].forEach((nom) => {
      this.load.spritesheet("sprite_potion_" + nom, "./assets/powerup/powerup_" + nom + ".png", { frameWidth: 16, frameHeight: 16 });
    });

    // menu (cf. menu.js et infos.js) : fond, logo et boutons
    this.load.image("img_fond_menu", "./assets/ui/background_artemis.jpg");
    this.load.image("img_logo", "./assets/ui/logo_artemis.png");
    ["solo", "duo", "controles", "credits"].forEach((nom) => {
      this.load.image("img_bouton_" + nom, "./assets/ui/bouton_" + nom + ".png");
    });

    // game over (cf. gameover.js)
    this.load.image("img_fond_game_over", "./assets/ui/background_game_over.jpg");
    this.load.image("img_titre_game_over", "./assets/ui/game_over.png");

    // cailloux (32x32)
    this.load.image("img_caillou_1", "./assets/rock1_3_no_shadow.png");
    this.load.image("img_caillou_2", "./assets/rock5_3_no_shadow.png");
    this.load.image("img_caillou_lune_1", "./assets/map/caillou_lune.png"); // cailloux lunaires à cristaux roses
    this.load.image("img_caillou_lune_2", "./assets/map/caillou_lune2.png");

    // ennemis (cf. ennemis.js) : slime et aliens, 8 frames de 32x32 ; l'alien vert a en plus 6 frames de tir
    this.load.spritesheet("sprite_alien_vert", "./assets/enemy/alien_vert.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("sprite_alien_vert_tir", "./assets/enemy/alien_vert_tir.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("sprite_alien_rouge", "./assets/enemy/alien_rouge.png", { frameWidth: 32, frameHeight: 32 });

    // passages entre les niveaux (32x32) : le trou avec son échelle pour descendre, l'échelle pour remonter
    this.load.image("img_trou", "./assets/map/hole_ladder.png");
    this.load.image("img_echelle", "./assets/map/ladder.png");

    // ennemi (slime) : 8 frames de 32x32
    this.load.spritesheet("sprite_slime", "./assets/enemy/slime_alien.png", { frameWidth: 32, frameHeight: 32 });

    // tirs : 4 frames de 16x16 (bleu pour le joueur 1, rouge pour le joueur 2)
    this.load.spritesheet("sprite_laser_bleu", "./assets/character/fire/laser_bleu.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("sprite_laser_rouge", "./assets/character/fire/laser_rouge.png", { frameWidth: 16, frameHeight: 16 });

    // joueurs : 4 frames de 32x32 par spritesheet (les images du joueur 2 sont dans mc2/, préfixées "mc2_")
    fct.JOUEURS.forEach((joueur) => {
      const dossier = "./assets/character/" + joueur.dossier + "/" + joueur.prefixe;
      DIRECTIONS.forEach((direction) => {
        VARIANTES_JOUEUR.forEach((variante) => {
          this.load.spritesheet(fct.cleSprite(joueur, "walk_" + direction + variante), dossier + "walk_" + direction + variante + ".png", {
            frameWidth: 32,
            frameHeight: 32
          });
        });
      });

      // descente / montée d'échelle : 8 frames de 32x32, le personnage vu de dos sur l'échelle (assets/character/anims/mc_ladder.png)
      this.load.spritesheet(fct.cleSprite(joueur, "echelle"), "./assets/character/anims/" + joueur.dossier + "_ladder.png", {
        frameWidth: 32,
        frameHeight: 32
      });

      // coup de pioche : 4 frames de 32x32 (pioche levée, levée, impact, retour)
      DIRECTIONS_PIOCHE.forEach((direction) => {
        this.load.spritesheet(fct.cleSprite(joueur, "pioche_" + direction), dossier + direction + "_pickaxe.png", {
          frameWidth: 32,
          frameHeight: 32
        });
      });
    });

    /* >>>>> AJOUT SON <<<<< */ // sons (16 ko/s max) : musiques et bruitages
    /* >>>>> AJOUT SON <<<<< */ this.load.audio("accueil", "./assets/sons/acceuil_son.mp3");
    /* >>>>> AJOUT SON <<<<< */ this.load.audio("fondSonore", "./assets/sons/fond_sonore.mp3");
    /* >>>>> AJOUT SON <<<<< */ this.load.audio("echelle", "./assets/sons/ladder.mp3");
    /* >>>>> AJOUT SON <<<<< */ this.load.audio("gameOver", "./assets/sons/music_game_over.mp3");
  }

  /***********************************************************************/
  /** FONCTION CREATE
/***********************************************************************/

  /* Les animations sont globales au jeu : on les crée une seule fois ici
   * pour qu'elles soient disponibles dans toutes les scenes.
   */
  create() {
    fct.JOUEURS.forEach((joueur) => {
      DIRECTIONS.forEach((direction) => {
        VARIANTES_JOUEUR.forEach((variante) => {
          this.anims.create({
            key: fct.cleAnim(joueur, "walk_" + direction + variante),
            frames: this.anims.generateFrameNumbers(fct.cleSprite(joueur, "walk_" + direction + variante)),
            frameRate: 8,
            repeat: -1 // -1 = infini
          });
        });
      });

      this.anims.create({
        key: fct.cleAnim(joueur, "echelle"),
        frames: this.anims.generateFrameNumbers(fct.cleSprite(joueur, "echelle")),
        frameRate: 12,
        repeat: -1
      });

      DIRECTIONS_PIOCHE.forEach((direction) => {
        this.anims.create({
          key: fct.cleAnim(joueur, "pioche_" + direction),
          frames: this.anims.generateFrameNumbers(fct.cleSprite(joueur, "pioche_" + direction)),
          frameRate: 14, // 4 frames : le coup dure environ 0,3 s
          repeat: 0 // une seule fois
        });
      });
    });

    this.anims.create({
      key: "anim_slime",
      frames: this.anims.generateFrameNumbers("sprite_slime"),
      frameRate: 8,
      repeat: -1
    });

    ["alien_vert", "alien_rouge"].forEach((nom) => {
      this.anims.create({ key: "anim_" + nom, frames: this.anims.generateFrameNumbers("sprite_" + nom), frameRate: 8, repeat: -1 });
    });
    this.anims.create({ key: "anim_alien_vert_tir", frames: this.anims.generateFrameNumbers("sprite_alien_vert_tir"), frameRate: 14, repeat: 0 });

    this.anims.create({
      key: "anim_cristal",
      frames: this.anims.generateFrameNumbers("sprite_cristal"),
      frameRate: 10,
      repeat: -1
    });

    ["heal", "vision", "vitesse"].forEach((nom) => {
      this.anims.create({
        key: "anim_potion_" + nom,
        frames: this.anims.generateFrameNumbers("sprite_potion_" + nom),
        frameRate: 8,
        repeat: -1
      });
    });

    ["bleu", "rouge"].forEach((couleur) => {
      this.anims.create({
        key: "anim_laser_" + couleur,
        frames: this.anims.generateFrameNumbers("sprite_laser_" + couleur),
        frameRate: 16,
        repeat: -1
      });
    });

    // tout est chargé : on ouvre le menu (qui lance la partie, cf. menu.js)
    // (après le chargement des typographies, cf. POLICES dans fonctions.js : un fichier absent n'empêche pas le jeu de démarrer)
    fct.chargerPolices().then(() => this.scene.start("menu"));
  }
}
