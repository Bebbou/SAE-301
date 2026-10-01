import * as fct from "./fonctions.js";

/***********************************************************************/
/** MENU PLACEHOLDER : choix entre jouer seul ou à deux
/***********************************************************************/

// les deux boutons, de haut en bas (images chargées dans selection.js)
const OPTIONS = [
  { image: "img_bouton_solo", nb_joueurs: 1 },
  { image: "img_bouton_duo", nb_joueurs: 2 }
];
const LARGEUR_BOUTON = 520; // px : largeur affichée des boutons (les images font environ 900 px)
const Y_PREMIER_BOUTON = 340; // px
const ECART_BOUTONS = 150; // px
const ECHELLE_SELECTION = 1.08; // le bouton choisi est un peu plus grand...
const OPACITE_AUTRES = 0.5; // ... et les autres sont assombris
const DUREE_FONDU = 300; // ms
const NB_ETOILES = 90;
// boutons d'action des joueurs qui valident le choix (la navigation se fait au joystick, haut / bas)
const BOUTONS_VALIDER = ["frapper_tirer", "sprint", "torche", "changer_equipement"];

// scene du menu : elle choisit le nombre de joueurs (registry "nb_joueurs"), remet le jeu à zéro puis lance le niveau 1
// n'importe quel joueur peut naviguer et valider, avec son joystick et ses boutons
export default class menu extends Phaser.Scene {
  constructor() {
    super({ key: "menu" });
  }

  create() {
    this.cameras.main.setBackgroundColor("#080D1C"); // bleu nuit de la palette
    this.cameras.main.fadeIn(DUREE_FONDU);
    this.lancement = false; // true dès qu'un choix est validé : on ignore alors les touches

    // fond d'étoiles
    const etoiles = this.add.graphics();
    for (let i = 0; i < NB_ETOILES; i++) {
      etoiles.fillStyle(0xddeaff, Phaser.Math.FloatBetween(0.15, 0.8));
      const taille = Phaser.Math.Between(1, 3);
      etoiles.fillRect(Phaser.Math.Between(0, this.scale.width), Phaser.Math.Between(0, this.scale.height), taille, taille);
    }

    this.add.text(this.scale.width / 2, 120, "ARTEMIS", { fontFamily: fct.POLICES.logo, fontSize: "104px", color: "#EC8697", stroke: "#20283A", strokeThickness: 10 })
      .setOrigin(0.5);
    this.add.text(this.scale.width / 2, 205, "un rogue-like sur la Lune", { fontFamily: fct.POLICES.texte, fontSize: "28px", color: "#BFC3CC" })
      .setOrigin(0.5);

    // les boutons sont réduits d'environ 40 % : on adoucit le filtre (le mode pixel art les rendrait crénelés)
    this.boutons = OPTIONS.map((option, i) => {
      this.textures.get(option.image).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const bouton = this.add.image(this.scale.width / 2, Y_PREMIER_BOUTON + i * ECART_BOUTONS, option.image);
      bouton.echelle_normale = LARGEUR_BOUTON / bouton.width;
      return bouton;
    });
    this.choix = 0; // indice du bouton choisi : jouer seul par défaut
    this.majSelection();

    this.add.text(this.scale.width / 2, this.scale.height - 60, "Joystick : choisir      Bouton : valider", { fontFamily: fct.POLICES.texte, fontSize: "24px", color: "#9AA0AE" })
      .setOrigin(0.5);

    // les touches des deux joueurs (cf. fonctions.js)
    this.touches = fct.JOUEURS.map((joueur) => fct.creerTouches(this, joueur.touches));
  }

  // met en avant le bouton choisi
  majSelection() {
    this.boutons.forEach((bouton, i) => {
      const choisi = i === this.choix;
      bouton.setScale(bouton.echelle_normale * (choisi ? ECHELLE_SELECTION : 1));
      bouton.setAlpha(choisi ? 1 : OPACITE_AUTRES);
    });
  }

  // enregistre le choix, remet le jeu à zéro et lance le premier niveau
  lancer() {
    this.lancement = true;
    // nouvelle partie : on oublie les niveaux visités (le jeu garde en mémoire l'état de chaque niveau pour pouvoir y revenir)
    this.registry.set("niveaux", {});
    this.registry.set("pierres_lunaires", 0);
    this.registry.set("nb_joueurs", OPTIONS[this.choix].nb_joueurs);
    this.cameras.main.fadeOut(DUREE_FONDU);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("niveau1", { niveau: 1 }));
  }

  update() {
    if (this.lancement) return;

    const appuye = (touche) => Phaser.Input.Keyboard.JustDown(touche);
    if (this.touches.some((t) => appuye(t.haut))) this.choix = (this.choix + OPTIONS.length - 1) % OPTIONS.length;
    if (this.touches.some((t) => appuye(t.bas))) this.choix = (this.choix + 1) % OPTIONS.length;
    this.majSelection();

    if (this.touches.some((t) => BOUTONS_VALIDER.some((bouton) => appuye(t[bouton])))) this.lancer();
  }
}
