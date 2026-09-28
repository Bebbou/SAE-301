const VITESSE_JOUEUR = 160; // px/s

export default class niveau1 extends Phaser.Scene {
  // constructeur de la classe
  constructor() {
    super({
      key: "niveau1" //  ici on précise le nom de la classe en tant qu'identifiant
    });
  }
  preload() {
  }

  create() {
    /*************************************
     *  CREATION DE LA MAP               *
     *************************************/
    const map = this.make.tilemap({ key: "map_test" });

    // premier parametre : nom du tileset dans Tiled / second : clé de l'image chargée dans selection
    const tilesets = [
      map.addTilesetImage("decorative_cracks_floor", "tiles_decorative_cracks_floor"),
      map.addTilesetImage("decorative_cracks_walls", "tiles_decorative_cracks_walls"),
      map.addTilesetImage("walls_floor", "tiles_walls_floor")
    ];

    // les noms des calques doivent etre identiques à ceux de Tiled
    map.createLayer("sol", tilesets);
    const calque_murs = map.createLayer("murs", tilesets);
    calque_murs.setCollisionByExclusion([-1]); // toutes les tuiles non vides du calque "murs" sont solides

    /****************************
     *  CREATION DU PERSONNAGE  *
     ****************************/
    this.player = this.physics.add.sprite(map.widthInPixels / 2, map.heightInPixels / 2, "sprite_joueur_idle_down");
    // hitbox réduite aux pieds du personnage (le sprite fait 96x80 mais le perso est bien plus petit)
    this.player.setSize(16, 10);
    this.player.setOffset(40, 48);
    this.player.setCollideWorldBounds(true);
    this.player.anims.play("anim_joueur_idle_down");
    this.direction = "down"; // dernière direction, pour l'animation idle

    this.physics.add.collider(this.player, calque_murs);

    /****************************
     *  MONDE ET CAMERA         *
     ****************************/
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player);

    this.clavier = this.input.keyboard.createCursorKeys();
  }

  update() {
    let vx = 0;
    let vy = 0;
    if (this.clavier.left.isDown) vx = -1;
    else if (this.clavier.right.isDown) vx = 1;
    if (this.clavier.up.isDown) vy = -1;
    else if (this.clavier.down.isDown) vy = 1;

    // normalisation : on ne va pas plus vite en diagonale
    this.player.body.velocity.set(vx, vy).normalize().scale(VITESSE_JOUEUR);

    // en diagonale, l'animation gauche/droite est prioritaire
    if (vx < 0) this.direction = "left";
    else if (vx > 0) this.direction = "right";
    else if (vy < 0) this.direction = "up";
    else if (vy > 0) this.direction = "down";

    const etat = vx !== 0 || vy !== 0 ? "run" : "idle";
    this.player.anims.play("anim_joueur_" + etat + "_" + this.direction, true);
  }
}
