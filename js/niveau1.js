import * as fct from "./fonctions.js";

const VITESSE_JOUEUR = 160; // px/s
const VITESSE_SPRINT = 260; // px/s
const PV_MAX = 100;
const STAMINA_MAX = 100;
const STAMINA_CONSO = 35; // stamina perdue par seconde de sprint
const STAMINA_RECUP = 20; // stamina regagnée par seconde sans sprinter

export default class niveau1 extends Phaser.Scene {
  // constructeur de la classe
  constructor() {
    super({
      key: "niveau1" //  ici on précise le nom de la classe en tant qu'identifiant
    });
  }
  preload() {
    this.load.image("sprite_laser", "./assets/character/fire/laser_bleu.png");
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
    this.player.pv = PV_MAX;
    this.player.stamina = STAMINA_MAX;

    this.physics.add.collider(this.player, calque_murs);
    this.projectiles = this.physics.add.group();
    this.physics.add.collider(this.projectiles, calque_murs, (projectile) => projectile.destroy());

    /****************************
     *  MONDE ET CAMERA         *
     ****************************/
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player);

    /****************************
     *  HUD                     *
     ****************************/
    this.barre_vie = fct.creerBarre(this, 20, 20, "sprite_barre_vie");
    this.barre_stamina = fct.creerBarre(this, 20, 76, "sprite_barre_stamina");

    this.clavier = this.input.keyboard.createCursorKeys();
    this.touche_sprint = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.touche_tir = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  update(time, delta) {
    const secondes = delta / 1000;

    let vx = 0;
    let vy = 0;
    if (this.clavier.left.isDown) vx = -1;
    else if (this.clavier.right.isDown) vx = 1;
    if (this.clavier.up.isDown) vy = -1;
    else if (this.clavier.down.isDown) vy = 1;
    const bouge = vx !== 0 || vy !== 0;

    // stamina vide : il faut relâcher la touche avant de pouvoir re-sprinter
    if (this.touche_sprint.isUp) this.player.essouffle = false;

    // sprint : seulement si on bouge et qu'il reste de la stamina
    const sprint = this.touche_sprint.isDown && bouge && !this.player.essouffle;
    if (sprint) {
      this.player.stamina = Math.max(this.player.stamina - STAMINA_CONSO * secondes, 0);
      if (this.player.stamina === 0) this.player.essouffle = true;
    } else {
      this.player.stamina = Math.min(this.player.stamina + STAMINA_RECUP * secondes, STAMINA_MAX);
    }

    // normalisation : on ne va pas plus vite en diagonale
    this.player.body.velocity.set(vx, vy).normalize().scale(sprint ? VITESSE_SPRINT : VITESSE_JOUEUR);

    // en diagonale, l'animation gauche/droite est prioritaire
    if (vx < 0) this.direction = "left";
    else if (vx > 0) this.direction = "right";
    else if (vy < 0) this.direction = "up";
    else if (vy > 0) this.direction = "down";

    const etat = bouge ? "run" : "idle";
    this.player.anims.play("anim_joueur_" + etat + "_" + this.direction, true);

    if (Phaser.Input.Keyboard.JustDown(this.touche_tir)) this.tirer();

    fct.majBarre(this.barre_vie, this.player.pv, PV_MAX);
    fct.majBarre(this.barre_stamina, this.player.stamina, STAMINA_MAX);
  }

  tirer() {
    const directions = {
      down: { x: 0, y: 1, angle: Math.PI / 2 },
      left: { x: -1, y: 0, angle: Math.PI },
      right: { x: 1, y: 0, angle: 0 },
      up: { x: 0, y: -1, angle: -Math.PI / 2 }
    };
    const direction = directions[this.direction];
    const projectile = this.projectiles.create(
      this.player.x + direction.x * 24,
      this.player.y + direction.y * 24,
      "sprite_laser"
    );

    projectile.setRotation(direction.angle);
    projectile.body.setAllowGravity(false);
    projectile.setVelocity(direction.x * 500, direction.y * 500);
    this.time.delayedCall(1200, () => projectile.destroy());
  }
}
