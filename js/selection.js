/***********************************************************************/
/** VARIABLES GLOBALES
/***********************************************************************/

// directions du joueur : une spritesheet idle + une run par direction
const DIRECTIONS = ["down", "left", "right", "up"];

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

    // HUD : 10 frames de 96x16 (de 1 à 10 segments remplis)
    this.load.spritesheet("sprite_barre_vie", "./assets/life.png", { frameWidth: 96, frameHeight: 16 });
    this.load.spritesheet("sprite_barre_stamina", "./assets/stamina.png", { frameWidth: 96, frameHeight: 16 });

<<<<<<< Updated upstream
    // joueur : 8 frames de 96x80 par spritesheet
=======
    // cailloux (32x32)
    this.load.image("img_caillou_1", "./assets/rock1_3_no_shadow.png");
    this.load.image("img_caillou_2", "./assets/rock5_3_no_shadow.png");

    // tir du joueur : 4 frames de 16x16
    this.load.spritesheet("sprite_laser_bleu", "./assets/character/fire/laser_bleu.png", { frameWidth: 16, frameHeight: 16 });

    // joueur : 4 frames de 32x32 par spritesheet
>>>>>>> Stashed changes
    DIRECTIONS.forEach((direction) => {
      this.load.spritesheet("sprite_joueur_idle_" + direction, "./assets/character/mc/idle/idle_" + direction + ".png", {
        frameWidth: 96,
        frameHeight: 80
      });
      this.load.spritesheet("sprite_joueur_run_" + direction, "./assets/character/mc/run/run_" + direction + ".png", {
        frameWidth: 96,
        frameHeight: 80
      });
    });
  }

  /***********************************************************************/
  /** FONCTION CREATE
/***********************************************************************/

  /* Les animations sont globales au jeu : on les crée une seule fois ici
   * pour qu'elles soient disponibles dans toutes les scenes.
   */
  create() {
    DIRECTIONS.forEach((direction) => {
      this.anims.create({
        key: "anim_joueur_idle_" + direction,
        frames: this.anims.generateFrameNumbers("sprite_joueur_idle_" + direction),
        frameRate: 8,
        repeat: -1 // -1 = infini
      });
      this.anims.create({
        key: "anim_joueur_run_" + direction,
        frames: this.anims.generateFrameNumbers("sprite_joueur_run_" + direction),
        frameRate: 12,
        repeat: -1
      });
    });

<<<<<<< Updated upstream
=======
    this.anims.create({
      key: "anim_laser_bleu",
      frames: this.anims.generateFrameNumbers("sprite_laser_bleu"),
      frameRate: 16,
      repeat: -1
    });

    // échelle placeholder dessinée en code (pas encore d'asset)
    const g = this.add.graphics();
    g.fillStyle(0x9dd9ff);
    g.fillRect(6, 0, 4, 32); // montant gauche
    g.fillRect(22, 0, 4, 32); // montant droit
    for (let y = 3; y < 32; y += 7) g.fillRect(6, y, 20, 3); // barreaux
    g.generateTexture("img_echelle", 32, 32);
    g.destroy();

>>>>>>> Stashed changes
    // pas encore de menu : on lance directement le niveau de test
    this.scene.start("niveau1");
  }
}
