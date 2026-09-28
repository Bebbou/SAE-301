import * as fct from "./fonctions.js";

const VITESSE_JOUEUR = 160; // px/s
const VITESSE_SPRINT = 260; // px/s
const PV_MAX = 100;
const STAMINA_MAX = 100;
const STAMINA_CONSO = 35; // stamina perdue par seconde de sprint
const STAMINA_RECUP = 20; // stamina regagnée par seconde sans sprinter
const DISTANCE_MIN_ECHELLE = 200; // px : l'échelle n'apparait pas juste à coté du joueur
const DUREE_FONDU = 400; // ms

// scene de jeu : elle est relancée à chaque descente, avec le numéro du niveau suivant
export default class niveau1 extends Phaser.Scene {
  // constructeur de la classe
  constructor() {
    super({
      key: "niveau1" //  ici on précise le nom de la classe en tant qu'identifiant
    });
  }

  // données transmises par scene.start / scene.restart
  init(data) {
    this.niveau = data.niveau || 1;
    this.pv_depart = data.pv ?? PV_MAX;
    this.stamina_depart = data.stamina ?? STAMINA_MAX;
  }

  preload() {
  }

  create() {
    this.descente = false; // true pendant le fondu vers le niveau suivant

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
    const calque_sol = map.createLayer("sol", tilesets);
    const calque_murs = map.createLayer("murs", tilesets);
    calque_murs.setCollisionByExclusion([-1]); // toutes les tuiles non vides du calque "murs" sont solides

    /****************************
     *  CREATION DU PERSONNAGE  *
     ****************************/
    this.player = this.physics.add.sprite(map.widthInPixels / 2, map.heightInPixels / 2, "sprite_joueur_walk_down");
    // hitbox réduite aux pieds du personnage
    this.player.setSize(12, 6);
    this.player.setOffset(10, 25);
    this.player.setCollideWorldBounds(true);
    this.player.pv = this.pv_depart;
    this.player.stamina = this.stamina_depart;

    this.physics.add.collider(this.player, calque_murs);

    /****************************
     *  ECHELLE                 *
     ****************************/
    // TODO : quand il y aura des ennemis et des cailloux, l'échelle apparaitra
    // avec une probabilité qui augmente (cf. brainstorm). Pour l'instant elle est là dès le début.
    this.placerEchelle(calque_sol, calque_murs);

    /****************************
     *  MONDE ET CAMERA         *
     ****************************/
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player);
    this.cameras.main.fadeIn(DUREE_FONDU);

    /****************************
     *  HUD                     *
     ****************************/
    this.barre_vie = fct.creerBarre(this, 20, 20, "sprite_barre_vie");
    this.barre_stamina = fct.creerBarre(this, 20, 76, "sprite_barre_stamina");
    this.add.text(1260, 20, "Niveau " + this.niveau, { fontSize: "28px", color: "#E8EBF0" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.clavier = this.input.keyboard.createCursorKeys();
    this.touche_sprint = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
  }

  // pose l'échelle sur une case de sol libre (sans mur), au hasard, loin du joueur
  placerEchelle(calque_sol, calque_murs) {
    const cases_libres = calque_sol.filterTiles((tuile) =>
      !calque_murs.hasTileAt(tuile.x, tuile.y) &&
      Phaser.Math.Distance.Between(tuile.getCenterX(), tuile.getCenterY(), this.player.x, this.player.y) >= DISTANCE_MIN_ECHELLE
    );
    const tuile = Phaser.Utils.Array.GetRandom(cases_libres);
    this.echelle = this.physics.add.staticSprite(tuile.getCenterX(), tuile.getCenterY(), "img_echelle");
    this.echelle.body.setSize(16, 16); // il faut vraiment marcher dessus, pas juste la frôler
  }

  // fondu au noir puis relance de la scene avec le niveau suivant
  descendre() {
    this.descente = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.cameras.main.fadeOut(DUREE_FONDU);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.restart({
        niveau: this.niveau + 1,
        pv: this.player.pv,
        stamina: this.player.stamina
      });
    });
  }

  update(time, delta) {
    if (this.descente) return;

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

    // animation : la gauche est la droite retournée
    if (bouge) {
      let anim;
      if (vx === 0) anim = vy < 0 ? "up" : "down";
      else if (vy === 0) anim = "right";
      else anim = vy < 0 ? "up_diagonal" : "down_diagonal";
      this.player.setFlipX(vx < 0);
      this.player.anims.play("anim_joueur_walk_" + anim, true);
    } else {
      // pas d'animation idle : on s'arrête sur la première frame
      this.player.anims.stop();
      this.player.setFrame(0);
    }

    fct.majBarre(this.barre_vie, this.player.pv, PV_MAX);
    fct.majBarre(this.barre_stamina, this.player.stamina, STAMINA_MAX);

    // un seul joueur pour l'instant : en duo, il faudra que les deux soient sur l'échelle
    if (this.physics.overlap(this.player, this.echelle)) this.descendre();
  }
}
